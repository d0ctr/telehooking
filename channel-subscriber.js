class ChannelSubscriber {
    constructor(handler) {
        this.handler = handler;
        this.app = handler.app;
        this.logger = this.handler.logger.child({module: 'channel-subscriber'});
        this.redis = this.app.redis ? this.app.redis : null;
        this.active = false;
        this.telegram_chat_id = null;
        this._dump_retries = 0;
        this._restore_retries = 0;
    }
    
    notify(prev_state, new_state, watched_state) {
        if (!this.active) {
            return;
        }

        prev_state = this._parse_state(prev_state);
        new_state = this._parse_state(new_state);
        watched_state = this._parse_state(watched_state);
        this.logger.info(`Discord received updated state: ${JSON.stringify(watched_state)}`);

        let diff = {};

        // alone and muted
        if (prev_state.other_members && Object.keys(prev_state.other_members).length === 1
            && new_state.channel_id === undefined
            && Object.values(prev_state.other_members)[0].muted
            && watched_state.channel_id === prev_state.channel_id) {

            diff.type = 'foreveralone'
            diff = {
                ...diff,
                ...Object.values(prev_state.other_members)[0]
            }
        }
        // first join
        if ((!prev_state.channel_id || new_state.channel_id !== prev_state.channel_id)
            && new_state.other_members && Object.keys(new_state.other_members).length === 0
            && new_state.channel_id === watched_state.channel_id) {

            diff.type = 'first_join';
            diff = {
                ...diff,
                user_id: new_state.user_id,
                user_name: new_state.user_name,
                streaming: new_state.streaming,
                member_id: new_state.member_id
            }
        }
        // -first join
        if (prev_state.other_members && Object.keys(prev_state.other_members).length === 0
            && (!new_state.channel_id || new_state.channel_id !== prev_state.channel_id)
            && watched_state.channel_id === prev_state.channel_id) {

            diff.type= '-first_join';
            diff = {
                ...diff,
                user_id: prev_state.user_id,
                user_name: prev_state.user_name,
                streaming: prev_state.streaming,
                member_id: prev_state.member_id
            }
        }
        // new stream started but not everybody here
        if (new_state.other_members && Object.keys(new_state.other_members).length === 0
            && (prev_state.streaming !== new_state.streaming)
            && new_state.streaming
            && watched_state.channel_id === new_state.channel_id) {

            diff.type = 'new_stream';
            diff = {
                ...diff,
                user_id: new_state.user_id,
                user_name: new_state.user_name,
                streaming: new_state.streaming,
                member_id: new_state.member_id
            }
        }
        // -new stream
        if (new_state.other_members && Object.keys(new_state.other_members).length === 0
            && (prev_state.streaming !== new_state.streaming)
            && prev_state.streaming
            && watched_state.channel_id === prev_state.channel_id) {

            diff.type = '-new_stream';
            diff = {
                ...diff,
                user_id: new_state.user_id,
                user_name: new_state.user_name,
                streaming: new_state.streaming,
                member_id: new_state.member_id
            }
        }

        if (Object.keys(diff).length) {
            diff = {
                ...diff,
                channel_id: watched_state.channel_id,
                channel_name: watched_state.channel_name,
                channel_url: watched_state.channel_url,
                channel_type: watched_state.channel_type
            }
        }
        else {
            return;
        }
        this.logger.info(`Catched diff: ${JSON.stringify(diff)}`);
        if (diff && this.telegram_chat_id) {
            try{
                this.app.telegram_client.send_notification(diff, this.telegram_chat_id);
            }
            catch (e) {
                this.logger.error(`Couldn't send notification for ${this._guild.name}:${this._channel.name}:`)
            }
        }
    }

    _parse_state(state) {
        if (!state) return;
        let parsed_state = {};
        parsed_state.user_id = state.member.user.id;
        parsed_state.user_name = state.member.user.username;
        parsed_state.streaming= state.streaming;
        parsed_state.member_id = state.member.id;

        if (state.channel) {
            parsed_state.channel_id = state.channel.id;
            parsed_state.channel_name = state.channel.name;
            parsed_state.channel_url = state.channel.url;
            parsed_state.channel_type = state.channel.type;
            
            parsed_state.other_members = {};
            state.channel.members.forEach((member, key) => {
                if (key !== parsed_state.user_id) {
                    parsed_state.other_members[key] = 
                        {
                            user_id: member.user.id,
                            user_name: member.user.username,
                            streaming: member.voice.streaming,
                            member_id: member.id,
                            muted: member.voice.mute
                        };
                }
            });
        }

        return parsed_state;
    }

    async start(channel, telegram_chat_id) {
        if (this.active 
            && this.telegram_chat_id
            && this.telegram_chat_id === telegram_chat_id) return;
        if (!channel || !telegram_chat_id) return;
        this.active = true;
        this.telegram_chat_id = telegram_chat_id;
        this._channel = channel;
        this._guild = channel.guild;
        this.dump();
    }

    stop() {
        this.active = false;
        this.dump();
    }

    async dump() {
        if (!this.redis) {
            return;
        }
        this.redis.hmset(`${this._guild.id}:channel_subscriber:${this._channel.id}`, {
            active: this.active,
            telegram_chat_id: this.telegram_chat_id
        }).catch(err => {
            this.logger.error(`Error while dumping data for ${this._guild.id}:channel_subscriber`, err);
            if (this._dump_retries < 15) {
                this.logger.info(`Retrying dumping data for ${this._guild.id}:channel_subscriber`);
                setTimeout(this.dump.bind(this), 15000);
                this._dump_retries += 1;
            }
            else {
                this.logger.info(`Giving up on trying to dump data for ${this._guild.id}:channel_subscriber`);
                this._dump_retries = 0;
            }
        }).then(res => {
            if (res) {
                this._dump_retries = 0;
            }
        });
    }

    async restore(guild, channel_id) {
        if (!this.redis) {
            return;
        }
        if (!guild && !this._guild && !channel_id) {
            this.logger.error('Not enough input values to restore data.');
            return;
        }
        else if (!this._guild && guild) {
            this._guild = guild;
        }
        this._channel = this._guild.channels.resolve(channel_id);

        let data;
        try {
            data = await this.redis.hgetall(`${this._guild.id}:channel_subscriber:${this._channel.id}`);
        }
        catch (err) {
            this.logger.error(`Error while restoring data for ${this._guild.id}:channel_subscriber:${this._channel.id}`, err);
            if (this._restore_retries < 15) {
                this.logger.info(`Retrying restoring data for ${this._guild.id}:channel_subscriber:${this._channel.id}`);
                setTimeout(this.restore.bind(this), 15000);
                this._restore_retries += 1;
            }
            else {
                this.logger.info(`Giving up on trying to restore data for ${this._guild.id}:channel_subscriber:${this._channel.id}`);
                this._restore_retries = 0;
            }
            return;
        }

        if (!data || !data.active) {
            this.logger.info(`Nothing to restore for ${this._guild.id}:channel_subscriber:${this._channel.id}`);
            return;
        }
        else {
            this.logger.info(`Restored data for ${this._guild.id}: ${JSON.stringify(data)}`);
        }

        this.active = data.active === 'true';
        this.telegram_chat_id = data.telegram_chat_id;
        
        this.logger.info(`Parsed data: ${JSON.stringify({ active: this.active, telegram_chat_id: this.telegram_chat_id })}`);
    }

    delete_dump() {
        if (!this.redis) {
            return;
        }
        this.redis.del(`${this._guild.id}:channel_subscriber:${this._channel.id}`).catch((err) => {
            this.logger.error(`Error while deleting dump for ${this._guild.id}:`, err);
        });
    }
}

module.exports = ChannelSubscriber;