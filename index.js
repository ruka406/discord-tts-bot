return;
  }

  // 読み上げ処理
  if (connection && !content.startsWith('!') && !content.startsWith('/')) {
    const userName = message.member?.displayName || message.author.username;
    
    let contentText = content;
    if (contentText.length > 50) {
      contentText = contentText.substring(0, 50) + '以下省略';
    }

    const textToSpeak = `${userName}。${contentText}`;
    speechQueue.push(textToSpeak);

    if (!isPlaying) {
      playNext();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
