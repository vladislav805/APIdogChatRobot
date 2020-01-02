import TelegramBot from 'node-telegram-bot-api';
import InlineKeyboard from './keyboards';
import reply from './reply';

/**
 * Ключи юзеров
 */
type TUserKey = 'v' | 't' | 'd' | 'c' | 'k';

/**
 * Ключи юзеров и иды
 */
const ids: Record<TUserKey, number> = {
	v: 63923,
	t: 97781725,
	d: 87476169,
	c: 485056,
	k: 257534697
};

/**
 * Ключи юзеров и юзернеймы
 */
const names: Record<TUserKey, string> = {
	v: 'vladislav805',
	t: 'Whoops',
	d: 'leodicapri',
	c: 'longpoll',
	k: 'soslowman'
};

// Игры
type TGame = 'game_cs' | 'game_pl';

// Ответ
type TAnswer = 'y' | 'n';

const KB_KEY_CS: TGame = 'game_cs';
const KB_KEY_PL: TGame = 'game_pl';

/*
 * 0 game
 * 1 keys_all
 * 2 keys_accept
 * 3 keys_decline
 * 4 answer y/n
 */

/**
 * Запаковка данных для кнопок
 * @param game Игра
 * @param keys Ожидаемые игроки
 * @param accept Согласившиеся игроки
 * @param decline Отказавшиеся игроки
 * @param answer Ответ
 */
const pack = (game: TGame, keys: string[], accept: string[], decline: string[], answer: TAnswer) => {
	return [game, keys.join(''), accept.join(''), decline.join(''), answer].join('/');
};

/**
 * Распаковка данных кнопки
 * @param str Строка data
 */
const unpack = (str: string): { game: TGame, keys: TUserKey[], accept: TUserKey[], decline: TUserKey[], answer: TAnswer } => {
	const [game, keys, accept, decline, answer] = str.split('/');
	return {
		game: game as TGame,
		keys: keys.split('') as TUserKey[],
		accept: accept.split('') as TUserKey[],
		decline: decline.split('') as TUserKey[],
		answer: answer as TAnswer
	};
};

/**
 * Создание строки для сообщения
 * @param game Игра
 * @param keys Ожидаемые игроки
 * @param accept Согласившиеся игроки
 * @param decline Отказавшиеся игроки
 * @returns Строка для сообщения
 */
const getMessageText = (game: TGame, keys: TUserKey[], accept: TUserKey[], decline: TUserKey[]) => {
	const blocks = [];
	if (keys.length) {
		blocks.push(`**Wait for**\n${getUserList(keys)}`);
	}

	if (accept.length) {
		blocks.push(`Y: ${getUserList(accept, ', ')}`);
	}

	if (decline.length) {
		blocks.push(`N: ${getUserList(decline, ', ')}`);
	}

	return `**Ping for ${game.replace('game_', '').toUpperCase()}**\n` + blocks.join('\n\n');
};

/**
 * Получение форматированной строки с юзернеймами пользователей
 * @param keys Ключи игроков
 * @param joiner Строка-соеденитель
 */
const getUserList = (keys: TUserKey[], joiner = '\n') => keys.map(key => `@${names[key]}`).join(joiner);

/**
 * Получение ключа игрока по его ид
 * @param id Ид юзера в Telegram
 */
const getKeyById = (id: number): TUserKey | null => {
	const arr = Object.keys(ids) as TUserKey[];

	for (let i = 0; i < arr.length; ++i) {
		if (ids[arr[i]] === id) {
			return arr[i];
		}
	}

	return null;
};

/**
 * Создание клавиатуры для сообщения
 * @param game Игра
 * @param keys Ожидаемые игроки
 * @param accept Согласившиеся игроки
 * @param decline Отказавшиеся игроки
 */
const getKeyboard = (game: TGame, keys: string[], accept: string[], decline: string[]) => {
	const kb: InlineKeyboard = new InlineKeyboard();
	const kbRow = kb.addRow();
	kbRow.addStringButton('Y', pack(game, keys, accept, decline, 'y'));
	kbRow.addStringButton('N', pack(game, keys, accept, decline, 'n'));
	return kb.make();
};

/**
 * Инициализация игрового модуля
 * @param bot Telegram-бот
 */
export default async function initGameVote(bot: TelegramBot) {
	const createListener = (game: TGame) => {
		return (message: TelegramBot.Message, match: string[]) => {
			const keys = match[2]?.split('');

			if (!keys || !keys.length) {
				reply(bot, message).text(`Не указаны тиммейты. Доступные ключи: \`${Object.keys(ids).join('`, `')}\``).send();
				return;
			}

			bot.sendMessage(message.chat.id, getMessageText(game, keys as TUserKey[], [], []), {
				disable_notification: false,
				parse_mode: 'Markdown',
				reply_to_message_id: message.message_id,
				reply_markup: getKeyboard(game, keys, [], [])
			});
		};
	};

	bot.onText(new RegExp(`^\\/cs(\\s-([${Object.keys(ids).join('')}]+))?`, 'igm'), createListener(KB_KEY_CS));
	bot.onText(new RegExp(`^\\/pubg(\\s-([${Object.keys(ids).join('')}]+))?`, 'igm'), createListener(KB_KEY_PL));

	bot.on('callback_query', ({ from, message, data, id }) => {
		const key = getKeyById(from.id);

		const { game, keys, accept, decline, answer } = unpack(data);

		if (!([KB_KEY_CS, KB_KEY_PL].includes(game))) {
			return;
		}

		if (!key || !keys.includes(key)) {
			bot.answerCallbackQuery(id, {
				cache_time: 1800,
				show_alert: true,
				text: 'Вас не спрашивали'
			});
			return;
		}

		switch (answer) {
			case 'y': accept.push(key); break;
			case 'n': decline.push(key); break;
			default: return;
		}

		keys.splice(keys.indexOf(key), 1);

		const text = getMessageText(game, keys, accept, decline);

		bot.editMessageText(text, {
			chat_id: message.chat.id,
			message_id: message.message_id,
			parse_mode: 'Markdown',
			reply_markup: getKeyboard(game, keys, accept, decline)
		});
	});

	bot.on('polling_error', error => console.error(error));
};
