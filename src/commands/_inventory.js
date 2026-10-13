'use strict';

/**
 * Inventaris nama command per kategori, sesuai spesifikasi proyek.
 * File ini HANYA daftar nama. Status sebenarnya (tested / implemented / needs_config / planned)
 * ditentukan oleh file implementasi di src/commands/** — nama yang belum punya implementasi
 * otomatis berstatus "planned" dan TIDAK tampil di .menu serta tidak dihitung di Total Cmd.
 * Urutan kategori mengikuti spesifikasi.
 */
module.exports = {
  AI: ['AI', 'AIChara', 'DeepSeek', 'Gemini', 'Gemma', 'GPT', 'JadiAnime', 'JadiAnimeV2', 'JadiGhibli', 'LLM', 'ResetAI', 'ResetAIGroup'],
  BOT: [
    'AnswerCall', 'AutoClear', 'AutoDelete', 'AutoRead', 'Bot', 'BotInfo', 'BotOfficial', 'BotSettings', 'ClearChat', 'DeleteChat',
    'GetPrivacySetting', 'GoStats', 'GroupMode', 'JadiBot', 'JoinMode', 'ListGroup', 'MsgStats', 'NSFW', 'Pacing', 'RejectCall',
    'ResetPassword', 'ScanBot', 'SelfMode', 'SetBotName', 'SetBotOwner', 'SetPP', 'SetPrivacy', 'Stats', 'TrackBot', 'UpCH', 'UpSW', 'UpSW2',
  ],
  DOWNLOADER: [
    'CapCut', 'Downloader', 'DownloadStickerPack', 'Facebook', 'GDrive', 'Gist', 'Gofile', 'Instagram', 'MediaFire', 'Pastebin',
    'PinterestDownloader', 'PixelDrain', 'Pixiv', 'TelegramSticker', 'TelegramStickerV2', 'Threads', 'TikTok', 'Douyin', 'Twitter', 'Xiaohongshu',
  ],
  FUN: ['Cek', 'Dadu', 'Fact', 'Koin', 'Meme', 'Reaction', 'Roast', 'Ship', 'Suit'],
  GAME: [
    'AsahOtak', 'Badges', 'CakLontong', 'GameLimit', 'GameStats', 'GlobalLeaderboard', 'GroupAchievements', 'GroupCarry', 'GroupCompare',
    'GroupContrib', 'GroupMVP', 'GroupStats', 'Leaderboard', 'Math', 'ProfileGame', 'Rival', 'SiapakahAku', 'SusunKata', 'TebakBendera',
    'TebakBom', 'TebakGambar', 'TebakKata', 'TebakLirik', 'TicTacToe',
  ],
  GENERAL: ['About', 'CekBenefit', 'Daily', 'Donatur', 'Help', 'Join', 'Limit', 'Menu', 'NSFW', 'Owner', 'Ping', 'Premium', 'Redeem', 'sc', 'Top'],
  GROUP: [
    'Add', 'AdminOnly', 'Adzan', 'AntiBot', 'AntiBug', 'AntiCall', 'AntiHideTag', 'AntiLink', 'AntiMedia', 'AntiNSFWMedia', 'AntiSpam', 'AntiSW',
    'AntiTagSw', 'AutoRespon', 'BadWord', 'BanChat', 'BanList', 'BanMember', 'CekBotAdmin', 'CekTanpaGrup', 'Close', 'Cmd', 'DebugPriority',
    'Delete', 'Demote', 'Ephemeral', 'GroupID', 'GroupInfo', 'GroupPrefix', 'GroupSettings', 'GStats', 'HideTag', 'Info', 'Jockey', 'JoinReq',
    'LeaveGroup', 'Left', 'LinkGC', 'ListAktif', 'ListBanMember', 'ListMute', 'ListTimezone', 'ListWarning', 'MuteMember', 'NSFW', 'Open',
    'PinMsg', 'Promote', 'Remove', 'ResetWarn', 'Revoke', 'ScheduleGroup', 'SetDesc', 'SetGoodbye', 'SetLang', 'SetPPGC', 'SetSubject',
    'SetTimezone', 'SetWelcome', 'Sider', 'SimulateGoodbye', 'SimulateWelcome', 'SyncGroup', 'TagAll', 'TopActive', 'UnbanChat', 'UnbanMember',
    'UnmuteMember', 'UnpinMsg', 'UpSWGC', 'Warn', 'Warnings', 'Welcome',
  ],
  MEDIA: ['FakeThumbnail', 'PhotoLive', 'TopTV'],
  MINIGAME: [
    '2048', 'Breakout', 'Chess', 'DinoRun', 'FlappyBird', 'Frogger', 'Galaga', 'Minesweeper', 'MiniGame', 'Pacman', 'Racing', 'Snake', 'Sudoku', 'Tetris',
  ],
  MUSIC: ['AmazonMusic', 'Play', 'Spotify', 'Tidal', 'YtMusic'],
  OWNER: ['BanList'],
  PROFILE: ['AFK', 'CekPremium', 'ChangePassword', 'GetPP', 'Level', 'Profile', 'SetAge', 'SetBio', 'SetGender', 'SetName', 'SetPrefix'],
  SEARCH: ['Google', 'JadwalSholat', 'Lyric', 'Pinterest', 'PinterestVideo', 'SauceNAO', 'Wallhaven', 'WhatAnime', 'YtMusicSearch', 'YtSearch'],
  TOOLS: [
    'ASCII85', 'ATBASH', 'AudioEffect', 'B32', 'B64', 'Barcode', 'BASE32', 'BASE64', 'BASE85', 'BestFrame', 'BIN', 'BINARY', 'Blur', 'Brat',
    'Calculator', 'CoAscii', 'Color', 'Compress', 'Crop', 'Decode', 'Emojimix', 'Encode', 'Flip', 'GetEXIF', 'GetIDCH', 'GetMedia', 'GetMsgID',
    'HEX', 'HTML', 'Humming', 'Iac', 'JadiBurik', 'JWT', 'Lang', 'Lens', 'Lorem', 'Lower', 'MediaQuality', 'MORSE', 'OCR', 'OCT', 'OCTAL',
    'Pesan', 'Pixelate', 'QC', 'QR', 'ReadMore', 'ReadQRIS', 'RemoveBG', 'Resize', 'Reverse', 'Romanize', 'ROT13', 'Rotate', 'SetQRIS', 'SMeme',
    'Smooth', 'SSWeb', 'Stabilize', 'Sticker', 'Testimage', 'ToDocMsg', 'ToGif', 'ToImage', 'ToMP3', 'ToVideo', 'Translate', 'Trim', 'TTS',
    'TTSAI', 'Upload', 'Upper', 'Upscaler', 'URL', 'WhatMusic',
  ],
  YOUTUBE: ['Album', 'Play', 'Play2', 'PlayDownloader', 'YouTube', 'YtMp3', 'YtMp4', 'YtMusic', 'YtMusicSearch', 'YtSearch'],
  JWS: ['jws'],
};
