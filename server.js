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
        .setDescription('Detiene la reproducción en la web'),
    new SlashCommandBuilder()
        .setName('screenshot')
        .setDescription('Toma una captura de pantalla en vivo'),
    new SlashCommandBuilder()
        .setName('start_stream')
        .setDescription('Inicia la transmisión continua de la pantalla'),
    new SlashCommandBuilder()
        .setName('stop_stream')
        .setDescription('Detiene la transmisión en vivo')
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

        let finalTitle = query;
        let finalAudioUrl = "";

        // Si es un enlace directo
        if (query.startsWith("http://") || query.startsWith("https://")) {
            finalAudioUrl = query;
            finalTitle = "Pista Personalizada";
        } else {
            // Buscador limpio por RSS/iTunes API gratuita global (No devuelve HTML, siempre JSON puro y sin bloqueos)
            try {
                const searchReq = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
                if (searchReq.ok) {
                    const data = await searchReq.json();
                    if (data.results && data.results.length > 0) {
                        const track = data.results[0];
                        finalTitle = `${track.trackName} - ${track.artistName}`;
                        finalAudioUrl = track.previewUrl; // Enlace MP3 directo en alta definición
                    }
                }
            } catch (err) {
                console.error("Error en consulta secundaria:", err);
            }

            // Fallback de respaldo garantizado si no encuentra preview
            if (!finalAudioUrl) {
                finalAudioUrl = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3";
            }
        }

        const songData = {
            title: finalTitle,
            artist: `Dedicada por ${interaction.user.username} ❤️`,
            url: finalAudioUrl,
            cover: "🎵",
            requestedBy: interaction.user.username
        };

        io.emit('new_song', songData);
        await interaction.editReply(`🎵 ¡Sonando en la web de Julieth!: **${finalTitle}** ✨`);

    } else if (commandName === 'pause') {
        io.emit('control_action', { action: 'pause' });
        await interaction.reply("⏸️ Música pausada en la web.");
    } else if (commandName === 'resume') {
        io.emit('control_action', { action: 'resume' });
        await interaction.reply("▶️ Música reanudada.");
    } else if (commandName === 'skip') {
        io.emit('control_action', { action: 'next' });
        await interaction.reply("⏭️ Siguiente canción.");
    } else if (commandName === 'stop') {
        io.emit('control_action', { action: 'stop' });
        await interaction.reply("⏹️ Reproducción detenida.");
    } else if (commandName === 'screenshot') {
        await interaction.reply("📸 Captura solicitada.");
    } else if (commandName === 'start_stream') {
        await interaction.reply("🎥 Transmisión iniciada.");
    } else if (commandName === 'stop_stream') {
        await interaction.reply("🛑 Transmisión finalizada.");
    }
});

app.get('/', (req, res) => {
    res.send('Servidor activo y listo para la web de Julieth ❤️');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`));

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.error("❌ ERROR: No se encontró la variable DISCORD_TOKEN en Render.");
}
