const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    Events 
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- 설정 (ID값들) ---
const GUILD_ID = '1477295369124843663';
const CMD_CHANNEL_ID = '1495542886480085183'; // 명령어 수행 및 로그 채널
const WELCOME_CHANNEL_ID = '1477330172611923998'; // 환영 멘트 채널

// 역할 ID (본인 서버의 ID로 수정 필요)
const ROLE_UNVERIFIED_ID = '000000000000000000'; // 미입장 역할 ID
const ROLE_MEMBER_ID = '000000000000000000';      // 멤버 역할 ID

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // 슬래시 명령어 등록 (특정 서버 대상)
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
        await guild.commands.set([
            {
                name: '안내',
                description: '유저 안내 및 역할 부여를 시작합니다 (이름/경로 입력)',
                options: [
                    {
                        name: 'user',
                        type: 6, // USER type
                        description: '안내를 진행할 유저를 선택하세요',
                        required: true
                    }
                ]
            }
        ]);
        console.log('Slash commands registered.');
    }
});

client.on(Events.InteractionCreate, async interaction => {
    // 1. 슬래시 명령어 처리
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === '안내') {
            if (interaction.channelId !== CMD_CHANNEL_ID) {
                return interaction.reply({ content: '지정된 채널에서만 사용 가능합니다.', ephemeral: true });
            }

            const targetUser = interaction.options.getMember('user');
            if (!targetUser) return interaction.reply({ content: '유저를 찾을 수 없습니다.', ephemeral: true });

            // 모달창 생성
            const modal = new ModalBuilder()
                .setCustomId(`guide_modal_${targetUser.id}`)
                .setTitle(`${targetUser.displayName}님 안내 등록`);

            const nameInput = new TextInputBuilder()
                .setCustomId('nameInput')
                .setLabel('이름')
                .setPlaceholder('이름을 입력해주세요.')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const routeInput = new TextInputBuilder()
                .setCustomId('routeInput')
                .setLabel('경로')
                .setPlaceholder('가입 경로를 적어주세요 (예: 디코올, 홍보지 등)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(routeInput)
            );

            await interaction.showModal(modal);
        }
    }

    // 2. 모달 제출 처리
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('guide_modal_')) {
            const targetId = interaction.customId.replace('guide_modal_', '');
            const guild = interaction.guild;
            
            try {
                const targetMember = await guild.members.fetch(targetId);
                const inputName = interaction.fields.getTextInputValue('nameInput');
                const inputRoute = interaction.fields.getTextInputValue('routeInput');

                // 역할 변경
                const unverifiedRole = guild.roles.cache.get(ROLE_UNVERIFIED_ID);
                const memberRole = guild.roles.cache.get(ROLE_MEMBER_ID);

                if (unverifiedRole && targetMember.roles.cache.has(ROLE_UNVERIFIED_ID)) {
                    await targetMember.roles.remove(unverifiedRole);
                }
                if (memberRole) {
                    await targetMember.roles.add(memberRole);
                }

                // 닉네임 변경 (멤버 [이름])
                await targetMember.setNickname(`멤버 ${inputName}`);

                // 로그 남기기
                const logChannel = guild.channels.cache.get(CMD_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`${targetMember} / ${inputName} / ${inputRoute} / ${interaction.user}`);
                }

                // 환영 메시지 (임베드)
                const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
                if (welcomeChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle(`${targetMember.displayName}님, 어서오세요 !`)
                        .setDescription(
                            `<#1477299965955936266> 해당 채널에서 규칙을 숙지 해주세요 .ᐟ\n` +
                            `<#1477327741920608478> 해당 채널에서 원하시는 역할을 받아주세요 .ᐟ\n` +
                            `즐거운 서버 활동 되세요 .ᐟ`
                        )
                        .setColor(0x0099FF);

                    await welcomeChannel.send({ content: `@here ${targetMember}`, embeds: [welcomeEmbed] });
                }

                await interaction.reply({ content: '처리가 완료되었습니다.', ephemeral: true });

            } catch (error) {
                console.error(error);
                if (!interaction.replied) {
                    await interaction.reply({ content: '오류가 발생했습니다. 권한 설정을 확인하세요.', ephemeral: true });
                }
            }
        }
    }
});

client.login(process.env.TOKEN);
