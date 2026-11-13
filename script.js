// НАСТРОЙКИ SUPABASE (замените на свои данные из личного кабинета Supabase)
const SUPABASE_URL = 'ВАШ_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'ВАШ_SUPABASE_ANON_KEY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const groupSelect = document.getElementById('groupSelect');
const btnToday = document.getElementById('btnToday');
const btnNow = document.getElementById('btnNow');
const resultContent = document.getElementById('resultContent');

// 1. При загрузке страницы подгружаем список групп из таблицы `groups`
async function loadGroups() {
    const { data, error } = await supabaseClient
        .from('groups')
        .select('*');

    if (error) {
        resultContent.textContent = 'Ошибка загрузки групп: ' + error.message;
        return;
    }

    groupSelect.innerHTML = '<option value="">-- Выберите группу --</option>';
    data.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
    });
}

loadGroups();

// 2. Обработка кнопки /today (Расписание на сегодня)
btnToday.addEventListener('click', async () => {
    const groupId = groupSelect.value;
    if (!groupId) {
        alert('Пожалуйста, выберите группу!');
        return;
    }

    // Определяем день недели (в JS: 0 - Воскресенье, 1 - Пн ... 6 - Сб)
    // По условию лабораторной: 1 — Пн ... 6 — Сб. Скорректируем под БД:
    let jsDay = new Date().getDay();
    let dayOfWeek = jsDay === 0 ? 7 : jsDay; // Если воскресенье, можно поставить 7 или выдать сообщение

    if (dayOfWeek === 7) {
        resultContent.textContent = 'Сегодня воскресенье. Занятий нет! 🎉';
        return;
    }

    const { data, error } = await supabaseClient
        .from('schedule')
        .select('*')
        .eq('group_id', groupId)
        .eq('day_of_week', dayOfWeek)
        .order('lesson_number', { ascending: true });

    if (error) {
        resultContent.textContent = 'Ошибка запроса: ' + error.message;
        return;
    }

    if (data.length === 0) {
        resultContent.textContent = 'На сегодня пар нет!';
        return;
    }

    let output = `📅 Расписание на сегодня:\n\n`;
    data.forEach(lesson => {
        output += `${lesson.lesson_number} пара: ${lesson.subject_name} (${lesson.time_start} - ${lesson.time_end})\n`;
    });
    resultContent.textContent = output;
});

// 3. Обработка кнопки /now (Какая пара идет прямо сейчас)
btnNow.addEventListener('click', async () => {
    const groupId = groupSelect.value;
    if (!groupId) {
        alert('Пожалуйста, выберите группу!');
        return;
    }

    let jsDay = new Date().getDay();
    let dayOfWeek = jsDay === 0 ? 7 : jsDay;

    if (dayOfWeek === 7) {
        resultContent.textContent = 'Сегодня воскресенье. Пар нет.';
        return;
    }

    // Получаем текущее время в формате "HH:MM:SS" или "HH:MM"
    const now = new Date();
    const currentTimeStr = now.toTimeString().split(' ')[0]; // строка вида "14:35:00"

    const { data, error } = await supabaseClient
        .from('schedule')
        .select('*')
        .eq('group_id', groupId)
        .eq('day_of_week', dayOfWeek)
        .order('lesson_number', { ascending: true });

    if (error) {
        resultContent.textContent = 'Ошибка запроса: ' + error.message;
        return;
    }

    if (data.length === 0) {
        resultContent.textContent = 'На сегодня пар нет.';
        return;
    }

    let currentLesson = null;
    let nextLesson = null;

    for (let i = 0; i < data.length; i++) {
        let lesson = data[i];
        // Сравниваем время строками (формат HH:MM:SS позволяет корректное сравнение)
        if (currentTimeStr >= lesson.time_start && currentTimeStr <= lesson.time_end) {
            currentLesson = lesson;
            break;
        }
        // Ищем следующую пару, если текущее время меньше начала
        if (currentTimeStr < lesson.time_start) {
            nextLesson = lesson;
            break;
        }
    }

    if (currentLesson) {
        resultContent.textContent = `🔥 Сейчас идет пара:\n${currentLesson.lesson_number} пара: ${currentLesson.subject_name} (${currentLesson.time_start} - ${currentLesson.time_end})`;
    } else if (nextLesson) {
        resultContent.textContent = `⏳ Сейчас перемена (или пары еще не начались).\nСледующая пара:\n${nextLesson.lesson_number} пара: ${nextLesson.subject_name} в ${nextLesson.time_start}`;
    } else {
        resultContent.textContent = `🏁 На сегодня все пары уже закончились!`;
    }
});
