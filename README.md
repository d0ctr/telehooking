<div align="center">
    <p style="text-align:center;">
    <a><img src="https://github.com/d0ctr/telehooking/raw/main/docs/TeleHookingLogo.png" width="50%" height="50%" /></a>
    </p>
    <br />
    <p>
    <a href="/LICENSE.md" ><img src="https://img.shields.io/github/license/d0ctr/telehooking" alt="License" /></a>
    <a><img src="https://img.shields.io/github/package-json/v/d0ctr/telehooking" /></a>
    <a href="https://www.npmjs.com/package/grammy/v/1.11.2"><img alt="GitHub package.json dependency version (prod)" src="https://img.shields.io/github/package-json/dependency-version/d0ctr/telehooking/grammy" />
    </p>
</div>

<h1><a href="https://t.me/TeleHookingBot">@Telegram Webhook</a></h1>

This is an application that provides webhook functionality for Telegram.

  - [Functionality](#functionality)
    * [How to send payload](#how-to-send-payload)
  - [Using or altering code](#using-or-altering-code)
    * [Prerequisities](#prerequisities)
      + [Acquiring application runtime essentials](#acquiring-application-runtime-essentials)
      + [Required tools](#required-tools)
    * [Environment Variables](#environment-variables)
    * [Running Bot](#running-bot)
  - [Credits](#credits)


# Functionality
This application parses (if it can) a webhook payload data and sends the message to the configured Telegram chat.

## How to send payload
This applications provides following endpoint
  - `/webhook/<payload source>/<telegram chat id>`
    - It uses `<payload source>` to apply appropriate payload parser. If there is no parser for the source then stringified JSON will be sent.

## Supported payload sources
  - `github`
    - GitHub Event: `pull_request`, `deployment_status`
  - `railway` / `railway.app`

# Using or altering code

You can use this code to start your own bot/s or you may also contribute something very beautiful (basically anything other than my code).

## Prerequisities

### Acquiring application runtime essentials
  - Create Telegram bot. You can do it by following [official guide from Telegram](https://core.telegram.org/bots).

### Required tools
  - Internet.
  - Node.JS version 16.0.0 or above.
  - Package manager (I used npm).

## Environment Variables
To authenticate as  Telegram application needs tokens and other parameters, you should've acquired them in in guides described in [Prerequisities](#prerequisities).
This application automatically loads variables specified in [`.env`](https://www.youtube.com/watch?v=dQw4w9WgXcQ) file that you should create yourself or you can export environment variables anyway you like.

  - `TELEGRAM_TOKEN` — Telegram bot token
  - `PORT` — Port for API
  - `DOMAIN` — domain that application is available on 

## Running Bot
After specifying runtime parameters the way you like you can start bot by simple command:

```powershell
npm start
```
# Credits
  - Authored by [@d0ctr](https://d0ctr.github.io/d0ctr)
