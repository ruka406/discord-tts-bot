const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let connection = null;
const player = createAudioPlayer();
let speechQueue = [];
let isPlaying = false;
let targetChannelId = null;

client.on('ready', () => {
  console.log(`Botがログインしました: ${client.user.tag}`);
});

// 音声再生キューの処理
async function playNext() {
  if (speechQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const { text, lang } = speechQueue.shift();

  try {
    const url = googleTTS.getAudioUrl(text, {
      lang: lang || 'ja',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    const resource = createAudioResource(url);
    player.play(resource);
  } catch (error) {
    console.error('TTS生成エラー:', error);
    isPlaying = false;
    playNext();
  }
}

player.on(AudioPlayerStatus.Idle, () => {
  playNext();
});

player.on('error', error => {
  console.error('再生エラー:', error);
  isPlaying = false;
  playNext();
});

// VCの入退出イベント検知（自動接続・自動解除）
client.on('voiceStateUpdate', (oldState, newState) => {
  const guild = newState.guild;

  // Bot自身の動作は無視
  if (newState.member.user.bot) return;

  // 1. ユーザーがVCに入ったとき（Botが未接続なら自動接続）
  if (!oldState.channelId && newState.channelId) {
    const vc = newState.channel;
    // 人間（Bot以外）がいる場合接続
    const nonBots = vc.members.filter(m => !m.user.bot);
    if (nonBots.size > 0 && !connection) {
      targetChannelId = vc.id;
      connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });
      connection.subscribe(player);
      console.log(`自動接続しました: ${vc.name}`);
    }
  }

  // 2. ユーザーがVCから退出したとき（全員いなくなったら自動切断）
  if (connection && targetChannelId) {
    const currentVC = guild.channels.cache.get(targetChannelId);
    if (currentVC) {
      const nonBots = currentVC.members.filter(m => !m.user.bot);
      if (nonBots.size === 0) {
        connection.destroy();
        connection = null;
        targetChannelId = null;
        speechQueue = [];
        isPlaying = false;
        console.log('VCに人がいなくなったため、自動切断しました。');
      }
    }
  }
});

// チャットメッセージの読み上げ処理
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Botがボイスチャンネルに参加している場合のみ処理
  if (connection) {
    const content = message.content;

    // コマンド類やURLはスキップ
    if (content.startsWith('!') || content.startsWith('/') || content.startsWith('http')) return;

    const userName = message.member?.displayName || message.author.username;
    
    let contentText = content;
    if (contentText.length > 50) {
      contentText = contentText.substring(0, 50) + '以下省略';
    }

    const textToSpeak = `${userName}。${contentText}`;
    
    // キューに追加して順番に再生
    speechQueue.push({ text: textToSpeak, lang: 'ja' });

    if (!isPlaying) {
      playNext();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
