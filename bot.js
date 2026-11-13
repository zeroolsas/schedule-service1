const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// 1. НАСТРОЙКИ (замените на свои данные)
const BOT_TOKEN = '9126243896:AAGerRK3KuPINn2q6kHDAGZ7WEbn3jpV4Ts'; // Токен от @BotFather
const SUPABASE_URL = 'https://csecfwwtkylfifdakjqa.supabase.co';       // URL из Supabase (Settings -> API)
const SUPABASE_ANON_KEY = 'sb_secret_SsDlxzGYopaDkHa0aCeMCA_pYuSsPLk'; // Ключ из Supabase

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Простейшее временное хранилище выбранной группы для каждого пользователя Telegram
const userGroup = {};

// Команда /start
bot.start(async (ctx) => {
    // Получаем список групп из базы данных, чтобы пользователь мог выбрать свою
    const { data: groups, error } = await supabase.from('groups').select('*');
    
    if (error || !groups.length) {
        return ctx.reply('Ошибка загрузки групп из базы данных.');
    }

    let message = 'Привет! 🎓 Выберите вашу группу, отправив команду в формате:\n`/setgroup НазваниеГруппы`\n\nДоступные группы:\n';
    groups.forEach(g => {
        message += `- ${g.name}\n`;
    });

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Команда установки группы, например: /setgroup ВЕБ-21
bot.command('setgroup', async (ctx) => {
    const groupName = ctx.message.text.replace('/setgroup', '').trim();
    
    if (!groupName) {
        return ctx.reply('Пожалуйста, укажите название группы после команды, например: /setgroup ВЕБ-21');
    }

    // Ищем группу в БД
    const { data: group, error } = await supabase
        .from('groups')
        .select('*')
        .ilike('name', groupName)
        .single();

    if (error || !group) {
        return ctx.reply(`Группа "${groupName}" не найдена в базе данных.`);
    }

    // Сохраняем ID группы за пользователем
    userGroup[ctx.chat.id] = group;
    ctx.reply(`✅ Группа "${group.name}" успешно выбрана! Теперь вы можете использовать команды /today и /now.`);
});

// Команда /today (Расписание на сегодня)
bot.command('today', async (ctx) => {
    const group = userGroup[ctx.chat.id];
    if (!group) {
        return ctx.reply('Сначала выберите группу с помощью команды /start');
    }

    let jsDay = new Date().getDay();
    let dayOfWeek = jsDay === 0 ? 7 : jsDay;

    if (dayOfWeek === 7) {
        return ctx.reply('Сегодня воскресенье. Занятий нет! 🎉');
    }

    const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .eq('group_id', group.id)
        .eq('day_of_week', dayOfWeek)
        .order('lesson_number', { ascending: true });

    if (error) {
        return ctx.reply('Ошибка получения расписания: ' + error.message);
    }

    if (!data.length) {
        return ctx.reply(`📅 У группы ${group.name} на сегодня пар нет!`);
    }

    let output = `📅 Расписание на сегодня (${group.name}):\n\n`;
    data.forEach(lesson => {
        output += `${lesson.lesson_number} пара: ${lesson.subject_name} (${lesson.time_start} - ${lesson.time_end})\n`;
    });

    ctx.reply(output);
});

// Команда /now (Что идет прямо сейчас)
bot.command('now', async (ctx) => {
    const group = userGroup[ctx.chat.id];
    if (!group) {
        return ctx.reply('Сначала выберите группу с помощью команды /start');
    }

    let jsDay = new Date().getDay();
    let dayOfWeek = jsDay === 0 ? 7 : jsDay;

    if (dayOfWeek === 7) {
        return ctx.reply('Сегодня воскресенье. Пар нет.');
    }

    const now = new Date();
    const currentTimeStr = now.toTimeString().split(' ')[0];

    const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .eq('group_id', group.id)
        .eq('day_of_week', dayOfWeek)
        .order('lesson_number', { ascending: true });

    if (error) {
        return ctx.reply('Ошибка запроса: ' + error.message);
    }

    if (!data.length) {
        return ctx.reply('На сегодня пар нет.');
    }

    let currentLesson = null;
    let nextLesson = null;

    for (let i = 0; i < data.length; i++) {
        let lesson = data[i];
        if (currentTimeStr >= lesson.time_start && currentTimeStr <= lesson.time_end) {
            currentLesson = lesson;
            break;
        }
        if (currentTimeStr < lesson.time_start) {
            nextLesson = lesson;
            break;
        }
    }

    if (currentLesson) {
        ctx.reply(`🔥 Сейчас идет пара:\n${currentLesson.lesson_number} пара: ${currentLesson.subject_name} (${currentLesson.time_start} - ${currentLesson.time_end})`);
    } else if (nextLesson) {
        ctx.reply(`⏳ Сейчас перемена.\nСледующая пара:\n${nextLesson.lesson_number} пара: ${nextLesson.subject_name} в ${nextLesson.time_start}`);
    } else {
        ctx.reply(`🏁 На сегодня все пары уже закончились!`);
    }
});

// Запуск бота
bot.launch();
console.log('Бот успешно запущен!');

// Корреактная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
