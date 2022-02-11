class WordleScheduler {
    constructor(app) {
        this.wordle_url = 'https://www.powerlanguage.co.uk/wordle/';
        this.event_name = "Угадывай слово";
        this.event_selector = '#wordle'
        this.start_hour = 21;
        this.start_min = 0;
        this.event_duration_ms = (23 * 60 + 55) * 60 * 1000;
        this.running = false;
        this.redis = app.redis ? app.redis : undefined;
        this._dump_retries = 0;
        this._restore_retries = 0;
    }

    async start(guild) {
        if (this.running) return;
        if (!guild) return;
        this._guild = guild;

        await this._start_scheduling();
    }

    stop() {
        if(this._schedule_interval && this.running) {
            clearInterval(this._schedule_interval);
        }
        if (this.running) {
            this.running = false;
            this.dump();
        }
    }

    async _start_scheduling() {
        let now = new Date();
        now.setUTCSeconds(0, 0);

        if ((now.getUTCHours() == this.start_hour) && (now.getUTCMinutes() >= this.start_min) || (now.getUTCHours() > this.start_hour)) {
            now.setUTCDate(now.getUTCDate() + 1);
        }
        
        this.next_start = now.setUTCHours(this.start_hour, this.start_min);

        this.next_end = now.setTime(now.getTime() + this.event_duration_ms);

        await this._guild.scheduledEvents.create({
            name: this.event_name, 
            scheduledStartTime: this.next_start, 
            scheduledEndTime: this.next_end, 
            privacyLevel: 'GUILD_ONLY',
            entityType: 'EXTERNAL',
            entityMetadata: { location: this.wordle_url }
        });

        this._schedule_interval = setInterval(this._start_scheduling.bind(this), this.next_end - Date.now());
        
        this.running = true;
        
        this.dump();
    }

    async dump() {
        if (!this.redis) {
            return;
        }
        this.redis.hmset(`${this._guild.id}:wordle`, {
            event_name: this.event_name,
            event_selector: this.event_selector,
            next_start: this.next_start,
            next_end: this.next_end,
            running: this.running
        }).catch(err => {
            console.error(`Error while dumping data for ${this._guild.id}:`, err);
            if (this._dump_retries < 15) {
                console.log(`Retrying dumping data for ${this._guild.id}`);
                setInterval(this.dump.bind(this), 15000);
                this._dump_retries += 1;
            }
            else {
                console.log(`Giving up on trying to dump data for ${this._guild.id}`);
                this._dump_retries = 0;
            }
        }).then(res => {
            if (res) {
                this._dump_retries = 0;
            }
        });
    }

    async restore(guild) {
        if (!this.redis) {
            return;
        }
        if (!guild && !this._guild) {
            console.error('No guild to restore data for');
            return;
        }
        else if (!this._guild && guild) {
            this._guild = guild;
        }

        let data;
        try {
            data = await this.redis.hgetall(`${this._guild.id}:wordle`);
        }
        catch (err) {
            console.error(`Error while restoring data for ${this._guild.id}:`, err);
            if (this._restore_retries < 15) {
                console.log(`Retrying restoring data for ${this._guild.id}`);
                setInterval(this.restore.bind(this), 15000);
                this._restore_retries += 1;
            }
            else {
                console.log(`Giving up on trying to restore data for ${this._guild.id}`);
                this._restore_retries = 0;
            }
            return;
        }

        if (!data || !data.event_name) {
            console.log(`Nothing to restore for ${this._guild.id}`);
            return;
        }
        else {
            console.log(`Restored data for ${this._guild.id}: ${JSON.stringify(data)}`);
        }

        this.event_name = data.event_name;
        this.event_selector = data.event_selector;
        this.next_start = data.next_start ? new Number(data.next_start): undefined;
        this.next_end = data.next_end ? new Number(data.next_end) : undefined;
        this.running = data.running ? new Boolean(data.running) : false;
        
        console.log(`Parsed data ${JSON.stringify(this)}`);

        if (!this.running) {
            return;
        }

        if (this.next_end < Date.now() || !this.next_end || !this.next_start) {
            this._start_scheduling();
            return;
        }
        else {
            this._schedule_interval = setInterval(this._start_scheduling.bind(this), this.next_end - Date.now());
        }
    }

    delete_dump() {
        if (!this.redis) {
            return;
        }
        this.redis.hdel(`${this._guild.id}:wordle`, ['event_name', 'event_selector', 'next_start', 'next_end', 'running']).catch((err) => {
            console.error(`Error while deleting dump for ${this._guild.id}:`, err);
        });
    }
}

module.exports = WordleScheduler;
