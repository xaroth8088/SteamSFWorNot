# Steam SFW or Not?
Can you tell if a game is SFW based on the title alone?  I assure you it's not as easy as it sounds...

## Setup
Install a recent version of Node.js, then:

```shell
corepack enable
yarn
yarn dev
```

### Why can't I just play this online?
The game relies on making API calls to Valve's store APIs to get details about games, and Valve did a good job with their store's CORS configuration.  Running it locally goes through the Vite development proxy.

## How to Play
* Guess whether a given game name is SFW or NSFW
  * NSFW here means "contains partial nudity, nudity, or is marked adult-only"
* If you are not sure, click "I don't know" and you'll be given a hint - but you'll get fewer points!
  * You can do this a second time, but after that you'll have to make a guess
* Keep guessing until you get one wrong
* See a game you think you might like, or just want to learn more about?  Click the game's banner and be taken to the store!

## Disclaimers
This game is not endorsed or authorized by Valve software, and should be considered a work of parody.  All game titles, images, and descriptions come directly from the games' developers/publishers as appear on the Steam store, and do not necessarily represent the opinions of this game's developers nor those of Valve software.  All rights reserved by their respective rights-holders.
