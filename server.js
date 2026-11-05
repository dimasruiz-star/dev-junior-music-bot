const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
                .setDescription('Nombre de la canción (sugerencias automáticas)')
                .setAutocomplete(true)
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
    console.log(`🤖 Bot conectado como: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash Commands con Autocomplete registrados.');
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        const focusedOption = interaction.options.getFocused();
        if (!focusedOption || focusedOption.trim() === '') {
            return await interaction.respond([]);
        }

        try {
            const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(focusedOption)}&limit=7`);
            const data = await res.json();

            if (data && data.data) {
                const choices = data.data.map(track => {
                    const durationMin = Math.floor(track.duration / 60);
                    const durationSec = String(track.duration % 60).padStart(2, '0');
                    return {
                        name: `🎵 ${track.artist.name} - "${track.title}" - ${durationMin}:${durationSec}`,
                        value: `${track.title} ${track.artist.name}`
                    };
                });
                await interaction.respond(choices);
            } else {
                await interaction.respond([]);
            }
        } catch (err) {
            console.error("Error en autocomplete:", err);
            await interaction.respond([]);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'play') {
        const query = interaction.options.getString('cancion');
        await interaction.deferReply();

        let trackTitle = query;
        let trackArtist = `Dedicada por ${interaction.user.username} ❤️`;
        let audioStreamUrl = "";
        let coverArt = "🎵";

        if (query.startsWith("http://") || query.startsWith("https://")) {
            audioStreamUrl = query;
            trackTitle = "Enlace Directo de Audio";
        } else {
            try {
                const response = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
                const data = await response.json();

                if (data && data.data && data.data.results && data.data.results.length > 0) {
                    const song = data.data.results[0];
                    trackTitle = song.name;
                    trackArtist = song.primaryArtists ? `${song.primaryArtists} ❤️` : trackArtist;

                    if (song.image && song.image.length > 0) {
                        coverArt = song.image[song.image.length - 1].url || song.image[song.image.length - 1].link;
                    }

                    if (song.downloadUrl && song.downloadUrl.length > 0) {
                        const bestQuality = song.downloadUrl[song.downloadUrl.length - 1];
                        audioStreamUrl = bestQuality.url || bestQuality.link;
                    }
                }
            } catch (err) {
                console.error("Error buscando canción primaria:", err);
            }

            if (!audioStreamUrl) {
                try {
                    const fallbackRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData && fallbackData.data && fallbackData.data.length > 0) {
                        const track = fallbackData.data[0];
                        trackTitle = track.title;
                        trackArtist = `${track.artist.name} ❤️`;
                        audioStreamUrl = track.preview;
                        if (track.album && track.album.cover_medium) {
                            coverArt = track.album.cover_medium;
                        }
                    }
                } catch (e) {
                    console.error("Error en fallback:", e);
                }
            }
        }

        const songData = {
            title: trackTitle,
            artist: trackArtist,
            url: audioStreamUrl,
            cover: coverArt,
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
}
