const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce una canción en la página web de Julieth')
        .addStringOption(option =>
            option.setName('cancion')
                .setDescription('Nombre de la canción o enlace MP3')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pausa la música en la web de Julieth'),
    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Reanuda la música en la web de Julieth'),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Pasa a la siguiente canción en la web'),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Detiene la reproducción en la web')
].map(command => command.toJSON());

client.on('ready', async () => {
    console.log(`🤖 Bot de Discord conectado como: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash Commands registrados correctamente.');
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'play') {
        const query = interaction.options.getString('cancion');
        await interaction.deferReply();

        let trackTitle = query;
        let trackArtist = `Dedicada por ${interaction.user.username} ❤️`;
        let audioStreamUrl = "";

        if (query.startsWith("http://") || query.startsWith("https://")) {
            audioStreamUrl = query;
            trackTitle = "Enlace Directo de Audio";
        } else {
            try {
                const fallbackRes = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
                const data = await fallbackRes.json();

                if (data && data.data && data.data.results && data.data.results.length > 0) {
                    const song = data.data.results[0];
                    trackTitle = song.name;
                    trackArtist = song.primaryArtists ? `${song.primaryArtists} ❤️` : trackArtist;

                    if (song.downloadUrl && song.downloadUrl.length > 0) {
                        const highestQuality = song.downloadUrl[song.downloadUrl.length - 1];
                        audioStreamUrl = highestQuality.url || highestQuality.link;
                    }
                }
            } catch (err) {
                console.error("Error al obtener la canción completa:", err);
            }

            if (!audioStreamUrl) {
                audioStreamUrl = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3";
            }
        }

        const songData = {
            title: trackTitle,
            artist: trackArtist,
            url: audioStreamUrl,
            cover: "🎵",
            requestedBy: interaction.user.username
        };

        io.emit('new_song', songData);
        await interaction.editReply(`🎵 ¡Sonando en la web de Julieth!: **${trackTitle}** ✨`);

    } else if (commandName === 'pause') {
        io.emit('control_action', { action: 'pause' });
        await interaction.reply("⏸️ Música pausada.");
    } else if (commandName === 'resume') {
        io.emit('control_action', { action: 'resume' });
        await interaction.reply("▶️ Música reanudada.");
    } else if (commandName === 'skip') {
        io.emit('control_action', { action: 'next' });
        await interaction.reply("⏭️ Siguiente canción.");
    } else if (commandName === 'stop') {
        io.emit('control_action', { action: 'stop' });
        await interaction.reply("⏹️ Reproducción detenida.");
    }
});

app.get('/', (req, res) => {
    res.send('Servidor activo para la web de Julieth ❤️');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.error("❌ ERROR: Falta la variable DISCORD_TOKEN.");
}
