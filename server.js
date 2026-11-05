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
                .setDescription('Nombre de la canción')
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

        try {
            // Se utiliza una API limpia de búsqueda para obtener el enlace directo sin bloqueo de Render
            const response = await fetch(`https://pipe-api.vercel.app/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            let title = query;
            let streamUrl = "";

            if (data && data.results && data.results.length > 0) {
                title = data.results[0].title;
                streamUrl = data.results[0].audioUrl || data.results[0].url;
            } else {
                // Respaldo de búsqueda secundaria
                streamUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            }

            const songData = {
                title: title,
                artist: `Dedicada por ${interaction.user.username} ❤️`,
                url: streamUrl,
                cover: "🎵",
                requestedBy: interaction.user.username
            };

            io.emit('new_song', songData);
            await interaction.editReply(`🎵 ¡Reproduciendo en la web de Julieth!: **${title}** ✨`);
        } catch (error) {
            console.error("Error al buscar la canción:", error);
            const songData = {
                title: query,
                artist: `Dedicada por ${interaction.user.username} ❤️`,
                url: "",
                cover: "🪗",
                requestedBy: interaction.user.username
            };
            io.emit('new_song', songData);
            await interaction.editReply(`🎵 ¡Petición enviada a la web de Julieth!: **${query}** ✨`);
        }
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
