/**
 * Add missing high-demand networks: URBANFIT (SPb), Fitness House, BrightFit, more Alex Fitness.
 * Run: node scripts/add-missing-networks-gyms.mjs
 * Then copy src/data/gyms.json → api/prisma/data/gyms.json for Docker seed.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const gymsPath = join(root, 'src/data/gyms.json')
const citiesPath = join(root, 'src/data/cities.json')
const apiGymsPath = join(root, 'api/prisma/data/gyms.json')

const IMAGES = [
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=800&q=80&auto=format&fit=crop',
]

const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .split('')
    .map((ch) => TR[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function citySlug(city) {
  const map = {
    Москва: 'moskva',
    'Санкт-Петербург': 'sankt-peterburg',
    Кудрово: 'kudrovo',
    Мурино: 'murino',
    'Янино-1': 'yanino',
    Петергоф: 'petergof',
    Екатеринбург: 'ekaterinburg',
    Челябинск: 'chelyabinsk',
    Тюмень: 'tyumen',
    Казань: 'kazan',
    Самара: 'samara',
    Ижевск: 'izhevsk',
    Красноярск: 'krasnoyarsk',
    'Нижний Тагил': 'nizhniy-tagil',
    'Каменск-Уральский': 'kamensk-uralskiy',
    Мурманск: 'murmansk',
    Абакан: 'abakan',
    Гатчина: 'gatchina',
    Калининград: 'kaliningrad',
  }
  return map[city] || slug(city)
}

function makeId(network, name, city) {
  return `gym-${slug(network)}-${slug(name)}-${citySlug(city)}`
}

function stableStats(id) {
  const h = createHash('sha1').update(id).digest()
  return {
    membersCount: 55 + (h[0] % 120),
    activeNow: h[1] % 14,
  }
}

/**
 * Approx coords — enough for distance sorting / maps; refine later via geocoding.
 * @type {Array<{network:string,name:string,city:string,district:string,address:string,lat:number,lng:number}>}
 */
const RAW = [
  // ——— URBANFIT (urbanfitclub.ru) — SPb metro-area, high local demand ———
  { network: 'URBANFIT', name: 'URBANFIT Прометей', city: 'Санкт-Петербург', district: 'Гражданский проспект', address: 'проспект Просвещения, 80/1, ТК Прометей', lat: 60.0515, lng: 30.3355 },
  { network: 'URBANFIT', name: 'URBANFIT Кудрово', city: 'Кудрово', district: 'Кудрово', address: 'Европейский проспект, 13', lat: 59.9086, lng: 30.5135 },
  { network: 'URBANFIT', name: 'URBANFIT Наставников', city: 'Санкт-Петербург', district: 'Ладожская', address: 'проспект Наставников, 24/1', lat: 59.9458, lng: 30.4702 },
  { network: 'URBANFIT', name: 'URBANFIT Балтийский', city: 'Санкт-Петербург', district: 'Василеостровский', address: 'Большой проспект В.О., 68, ТЦ Балтийский', lat: 59.9345, lng: 30.2558 },
  { network: 'URBANFIT', name: 'URBANFIT Вояж', city: 'Санкт-Петербург', district: 'Проспект Просвещения', address: 'проспект Энгельса, 124/1', lat: 60.0388, lng: 30.3235 },
  { network: 'URBANFIT', name: 'URBANFIT Петергоф', city: 'Петергоф', district: 'Петергоф', address: 'Санкт-Петербургский проспект, 60', lat: 59.8778, lng: 29.9075 },
  { network: 'URBANFIT', name: 'URBANFIT Мурино', city: 'Мурино', district: 'Мурино', address: 'улица Екатерининская, 18/3', lat: 60.0512, lng: 30.4428 },
  { network: 'URBANFIT', name: 'URBANFIT Пионерская', city: 'Санкт-Петербург', district: 'Пионерская', address: 'Коломяжский проспект, 15/2', lat: 60.0026, lng: 30.2975 },
  { network: 'URBANFIT', name: 'URBANFIT Озерки', city: 'Санкт-Петербург', district: 'Озерки', address: 'проспект Энгельса, 120', lat: 60.0368, lng: 30.3218 },
  { network: 'URBANFIT', name: 'URBANFIT Большевиков', city: 'Санкт-Петербург', district: 'Проспект Большевиков', address: 'проспект Большевиков, 7/2', lat: 59.9168, lng: 30.4785 },
  { network: 'URBANFIT', name: 'URBANFIT Янино', city: 'Янино-1', district: 'Янино', address: 'улица Голландская, 9, мкр Янила Кантри', lat: 59.9485, lng: 30.5825 },
  { network: 'URBANFIT', name: 'URBANFIT Юго-запад', city: 'Санкт-Петербург', district: 'Кировский', address: 'проспект Маршала Жукова, 35/1', lat: 59.8545, lng: 30.2125 },
  { network: 'URBANFIT', name: 'URBANFIT Нео', city: 'Санкт-Петербург', district: 'Центральный', address: 'улица Красного Текстильщика, 10-12 литера C', lat: 59.9295, lng: 30.3658 },
  { network: 'URBANFIT', name: 'URBANFIT Ривер Хаус', city: 'Санкт-Петербург', district: 'Петроградский', address: 'улица Академика Павлова, 5В', lat: 59.9728, lng: 30.2685 },
  { network: 'URBANFIT', name: 'URBANFIT Академическая', city: 'Санкт-Петербург', district: 'Академическая', address: 'проспект Науки, 23/2', lat: 60.0128, lng: 30.3965 },
  { network: 'URBANFIT', name: 'URBANFIT Маршака', city: 'Санкт-Петербург', district: 'Калининский', address: 'проспект Маршака, 10', lat: 60.0005, lng: 30.4158 },
  { network: 'URBANFIT', name: 'URBANFIT Девяткино', city: 'Мурино', district: 'Девяткино', address: 'Привокзальная площадь, 3А/1', lat: 60.0505, lng: 30.4422 },
  { network: 'URBANFIT', name: 'URBANFIT Лиговский', city: 'Санкт-Петербург', district: 'Лиговский', address: 'Транспортный переулок, 1 литера А', lat: 59.9208, lng: 30.3555 },

  // ——— Fitness House (fitnesshouse.ru) — SPb + suburbs, top regional network ———
  { network: 'Fitness House', name: 'Fitness House Наличная', city: 'Санкт-Петербург', district: 'Васильевский остров', address: 'улица Наличная', lat: 59.9485, lng: 30.2355 },
  { network: 'Fitness House', name: 'Fitness House Гашека', city: 'Санкт-Петербург', district: 'Купчино', address: 'улица Ярослава Гашека', lat: 59.8515, lng: 30.3785 },
  { network: 'Fitness House', name: 'Fitness House Ленинский', city: 'Санкт-Петербург', district: 'Московский', address: 'Ленинский проспект / Краснопутиловская', lat: 59.8518, lng: 30.2685 },
  { network: 'Fitness House', name: 'Fitness House Хошимина', city: 'Санкт-Петербург', district: 'Комендантский', address: 'улица Хо Ши Мина', lat: 60.0085, lng: 30.2685 },
  { network: 'Fitness House', name: 'Fitness House Камышовая', city: 'Санкт-Петербург', district: 'Приморский', address: 'улица Камышовая', lat: 60.0015, lng: 30.2155 },
  { network: 'Fitness House', name: 'Fitness House Ветеранов', city: 'Санкт-Петербург', district: 'Кировский', address: 'проспект Ветеранов', lat: 59.8425, lng: 30.2155 },
  { network: 'Fitness House', name: 'Fitness House Пулковское', city: 'Санкт-Петербург', district: 'Московский', address: 'Пулковское шоссе', lat: 59.8125, lng: 30.3185 },
  { network: 'Fitness House', name: 'Fitness House Стачек', city: 'Санкт-Петербург', district: 'Кировский', address: 'проспект Стачек', lat: 59.8665, lng: 30.2615 },
  { network: 'Fitness House', name: 'Fitness House Новаторов', city: 'Санкт-Петербург', district: 'Кировский', address: 'бульвар Новаторов', lat: 59.8505, lng: 30.2555 },
  { network: 'Fitness House', name: 'Fitness House Салова', city: 'Санкт-Петербург', district: 'Фрунзенский', address: 'улица Салова', lat: 59.8885, lng: 30.3685 },
  { network: 'Fitness House', name: 'Fitness House Большевиков', city: 'Санкт-Петербург', district: 'Невский', address: 'проспект Большевиков', lat: 59.9165, lng: 30.4785 },
  { network: 'Fitness House', name: 'Fitness House Комендантский', city: 'Санкт-Петербург', district: 'Приморский', address: 'Комендантский проспект', lat: 60.0088, lng: 30.2585 },
  { network: 'Fitness House', name: 'Fitness House Чкаловская', city: 'Санкт-Петербург', district: 'Петроградский', address: 'улица Чкалова / Чкаловская', lat: 59.9605, lng: 30.2925 },
  { network: 'Fitness House', name: 'Fitness House Политехническая', city: 'Санкт-Петербург', district: 'Калининский', address: 'Политехническая улица', lat: 60.0055, lng: 30.3725 },
  { network: 'Fitness House', name: 'Fitness House Культуры', city: 'Санкт-Петербург', district: 'Выборгский', address: 'проспект Культуры', lat: 60.0385, lng: 30.3785 },
  { network: 'Fitness House', name: 'Fitness House Ладожская', city: 'Санкт-Петербург', district: 'Красногвардейский', address: 'район метро Ладожская', lat: 59.9325, lng: 30.4385 },
  { network: 'Fitness House', name: 'Fitness House Крестовский', city: 'Санкт-Петербург', district: 'Крестовский остров', address: 'Крестовский проспект', lat: 59.9725, lng: 30.2425 },
  { network: 'Fitness House', name: 'Fitness House Савушкина', city: 'Санкт-Петербург', district: 'Приморский', address: 'улица Савушкина', lat: 59.9855, lng: 30.2685 },
  { network: 'Fitness House', name: 'Fitness House Охта Молл', city: 'Санкт-Петербург', district: 'Красногвардейский', address: 'ТРЦ Охта Молл', lat: 59.9455, lng: 30.4125 },
  { network: 'Fitness House', name: 'Fitness House Рыбацкое', city: 'Санкт-Петербург', district: 'Невский', address: 'район Рыбацкое', lat: 59.8385, lng: 30.5085 },
  { network: 'Fitness House', name: 'Fitness House Кудрово', city: 'Кудрово', district: 'Кудрово', address: 'Европейский проспект, 21 стр.1', lat: 59.9095, lng: 30.5155 },
  { network: 'Fitness House', name: 'Fitness House Мурино', city: 'Мурино', district: 'Мурино', address: 'улица Шувалова, 11', lat: 60.0485, lng: 30.4455 },
  { network: 'Fitness House', name: 'Fitness House Девяткино', city: 'Мурино', district: 'Девяткино', address: 'улица Главная, 60', lat: 60.0525, lng: 30.4485 },
  { network: 'Fitness House', name: 'Fitness House Янино', city: 'Янино-1', district: 'Янино', address: 'Янино', lat: 59.9485, lng: 30.5755 },
  { network: 'Fitness House', name: 'Fitness House Гатчина', city: 'Гатчина', district: 'Гатчина', address: 'улица Генерала Кныша, 2А', lat: 59.5685, lng: 30.1285 },
  { network: 'Fitness House', name: 'Fitness House Лахта', city: 'Санкт-Петербург', district: 'Лахта', address: 'Лахтинский проспект, 85', lat: 59.9885, lng: 30.1555 },
  { network: 'Fitness House', name: 'Fitness House Славянка', city: 'Санкт-Петербург', district: 'Славянка', address: 'Славянка', lat: 59.7425, lng: 30.4525 },
  { network: 'Fitness House', name: 'Fitness House Шушары', city: 'Санкт-Петербург', district: 'Шушары', address: 'Шушары', lat: 59.8085, lng: 30.3785 },
  // remaining SPb clubs from fitnesshouse.ru/club.html selector
  { network: 'Fitness House', name: 'Fitness House Новогорелово', city: 'Санкт-Петербург', district: 'Новогорелово', address: 'п. Новогорелово, ул. Современников, 2А, ТЦ KRONUNG', lat: 59.7885, lng: 30.1455 },
  { network: 'Fitness House', name: 'Fitness House Светлановский', city: 'Санкт-Петербург', district: 'Светлановский', address: 'Светлановский проспект', lat: 60.0125, lng: 30.3285 },
  { network: 'Fitness House', name: 'Fitness House Богословская', city: 'Санкт-Петербург', district: 'Выборгский', address: 'улица Богословская', lat: 60.0285, lng: 30.3485 },
  { network: 'Fitness House', name: 'Fitness House Дальневосточный', city: 'Санкт-Петербург', district: 'Невский', address: 'Дальневосточный проспект', lat: 59.9085, lng: 30.4585 },
  { network: 'Fitness House', name: 'Fitness House Заречная', city: 'Санкт-Петербург', district: 'Приморский', address: 'улица Заречная', lat: 59.9985, lng: 30.2285 },
  { network: 'Fitness House', name: 'Fitness House Краснопутиловская', city: 'Санкт-Петербург', district: 'Московский', address: 'улица Краснопутиловская', lat: 59.8585, lng: 30.2885 },
  { network: 'Fitness House', name: 'Fitness House Маршака', city: 'Санкт-Петербург', district: 'Калининский', address: 'проспект Маршака', lat: 60.0005, lng: 30.4158 },
  { network: 'Fitness House', name: 'Fitness House Маршала Блюхера', city: 'Санкт-Петербург', district: 'Калининский', address: 'проспект Маршала Блюхера', lat: 59.9725, lng: 30.3785 },
  { network: 'Fitness House', name: 'Fitness House Маршала Говорова', city: 'Санкт-Петербург', district: 'Кировский', address: 'проспект Маршала Говорова', lat: 59.8685, lng: 30.2685 },
  { network: 'Fitness House', name: 'Fitness House Мебельная', city: 'Санкт-Петербург', district: 'Приморский', address: 'улица Мебельная', lat: 59.9985, lng: 30.2485 },
  { network: 'Fitness House', name: 'Fitness House Пискарёвский', city: 'Санкт-Петербург', district: 'Калининский', address: 'Пискарёвский проспект', lat: 59.9785, lng: 30.4085 },
  { network: 'Fitness House', name: 'Fitness House Пражская', city: 'Санкт-Петербург', district: 'Купчино', address: 'Пражская улица', lat: 59.8515, lng: 30.3785 },
  { network: 'Fitness House', name: 'Fitness House Северный', city: 'Санкт-Петербург', district: 'Выборгский', address: 'Северный проспект', lat: 60.0385, lng: 30.3585 },
  { network: 'Fitness House', name: 'Fitness House Таллинское шоссе', city: 'Санкт-Петербург', district: 'Красносельский', address: 'Таллинское шоссе', lat: 59.8385, lng: 30.1485 },
  { network: 'Fitness House', name: 'Fitness House Фучика', city: 'Санкт-Петербург', district: 'Фрунзенский', address: 'улица Фучика', lat: 59.8685, lng: 30.3785 },
  { network: 'Fitness House', name: 'Fitness House Хасанская', city: 'Санкт-Петербург', district: 'Красногвардейский', address: 'улица Хасанская', lat: 59.9485, lng: 30.4585 },
  { network: 'Fitness House', name: 'Fitness House Шаврова', city: 'Санкт-Петербург', district: 'Приморский', address: 'улица Шаврова', lat: 60.0085, lng: 30.2385 },

  // ——— BrightFit (brightfit.ru sitemap) — Urals + regions + Moscow ———
  { network: 'BrightFit', name: 'BrightFit Уралмаш', city: 'Екатеринбург', district: 'Уралмаш', address: 'улица Победы, 14а', lat: 56.8885, lng: 60.6125 },
  { network: 'BrightFit', name: 'BrightFit Успенский', city: 'Екатеринбург', district: 'Центр', address: 'улица Вайнера, 10', lat: 56.8355, lng: 60.5985 },
  { network: 'BrightFit', name: 'BrightFit Пионерский', city: 'Екатеринбург', district: 'Пионерский', address: 'улица Блюхера, 39', lat: 56.8585, lng: 60.6485 },
  { network: 'BrightFit', name: 'BrightFit Фан Фан', city: 'Екатеринбург', district: 'Юго-Западный', address: 'улица Ясная, 2', lat: 56.8085, lng: 60.5785 },
  { network: 'BrightFit', name: 'BrightFit Южный', city: 'Екатеринбург', district: 'Южный', address: 'улица 8 Марта, 128а', lat: 56.8085, lng: 60.6085 },
  { network: 'BrightFit', name: 'BrightFit Широкая речка', city: 'Екатеринбург', district: 'Широкая речка', address: 'улица Малопрудная, 5/4', lat: 56.8125, lng: 60.5485 },
  { network: 'BrightFit', name: 'BrightFit Ясная', city: 'Екатеринбург', district: 'Юго-Западный', address: 'улица Ясная, 33/2', lat: 56.8055, lng: 60.5755 },
  { network: 'BrightFit', name: 'BrightFit Кировский', city: 'Екатеринбург', district: 'Кировский', address: 'Кировский район', lat: 56.8485, lng: 60.6485 },
  { network: 'BrightFit', name: 'BrightFit Максидом', city: 'Екатеринбург', district: 'Екатеринбург', address: 'ТЦ Максидом', lat: 56.8285, lng: 60.5985 },
  { network: 'BrightFit', name: 'BrightFit Академия тенниса', city: 'Екатеринбург', district: 'Екатеринбург', address: 'Академия тенниса', lat: 56.8385, lng: 60.6185 },
  { network: 'BrightFit', name: 'BrightFit Академический', city: 'Екатеринбург', district: 'Академический', address: 'Академический район', lat: 56.7885, lng: 60.5285 },
  { network: 'BrightFit', name: 'BrightFit Балтийский', city: 'Екатеринбург', district: 'Екатеринбург', address: 'Балтийский', lat: 56.8185, lng: 60.5585 },
  { network: 'BrightFit', name: 'BrightFit Изумрудный бор', city: 'Екатеринбург', district: 'Екатеринбург', address: 'Изумрудный бор', lat: 56.8685, lng: 60.5485 },
  { network: 'BrightFit', name: 'BrightFit Алое Поле', city: 'Челябинск', district: 'Центр', address: 'проспект Ленина, 64Б', lat: 55.1605, lng: 61.4025 },
  { network: 'BrightFit', name: 'BrightFit Привилегия', city: 'Челябинск', district: 'Челябинск', address: 'улица Уютная', lat: 55.1525, lng: 61.3855 },
  { network: 'BrightFit', name: 'BrightFit Тополиная аллея', city: 'Челябинск', district: 'Челябинск', address: 'Тополиная аллея', lat: 55.1425, lng: 61.3685 },
  { network: 'BrightFit', name: 'BrightFit Сити молл', city: 'Тюмень', district: 'Тюмень', address: 'улица Тимофея Чаркова, 89', lat: 57.1525, lng: 65.5425 },
  { network: 'BrightFit', name: 'BrightFit Магеллан', city: 'Тюмень', district: 'Тюмень', address: 'улица 50 лет Октября, 14', lat: 57.1485, lng: 65.5585 },
  { network: 'BrightFit', name: 'BrightFit Черёмушки', city: 'Москва', district: 'Черёмушки', address: 'улица Профсоюзная, 31к5', lat: 55.6785, lng: 37.5585 },
  { network: 'BrightFit', name: 'BrightFit Лодочная', city: 'Москва', district: 'Северо-Западный', address: 'улица Лодочная, 43', lat: 55.8485, lng: 37.4585 },
  { network: 'BrightFit', name: 'BrightFit Останкино', city: 'Москва', district: 'Останкино', address: 'Останкино', lat: 55.8225, lng: 37.6085 },
  { network: 'BrightFit', name: 'BrightFit Медведева', city: 'Ижевск', district: 'Ижевск', address: 'улица Медведева, 10', lat: 56.8525, lng: 53.2085 },
  { network: 'BrightFit', name: 'BrightFit 9 января', city: 'Ижевск', district: 'Ижевск', address: 'улица 9 января', lat: 56.8485, lng: 53.2185 },
  { network: 'BrightFit', name: 'BrightFit Планета', city: 'Мурманск', district: 'Мурманск', address: 'улица Сполохи, 4', lat: 68.9585, lng: 33.0825 },
  { network: 'BrightFit', name: 'BrightFit Октябрьский', city: 'Самара', district: 'Самара', address: '5-я просека, 95', lat: 53.2125, lng: 50.1785 },
  { network: 'BrightFit', name: 'BrightFit Изумрудный', city: 'Казань', district: 'Казань', address: 'улица Комиссара Габишева, 36', lat: 55.7885, lng: 49.1225 },
  { network: 'BrightFit', name: 'BrightFit Алексеева', city: 'Красноярск', district: 'Красноярск', address: 'улица Алексеева, 48а', lat: 56.0185, lng: 92.8685 },
  { network: 'BrightFit', name: 'BrightFit Северный', city: 'Красноярск', district: 'Северный', address: 'улица Мате Залки, 5', lat: 56.0485, lng: 92.9085 },
  { network: 'BrightFit', name: 'BrightFit Каменск-Уральский', city: 'Каменск-Уральский', district: 'Каменск-Уральский', address: 'улица Каменская, 25', lat: 56.4185, lng: 61.9185 },
  { network: 'BrightFit', name: 'BrightFit Горошникова', city: 'Нижний Тагил', district: 'Нижний Тагил', address: 'улица Горошникова, 9', lat: 57.9105, lng: 59.9685 },
  { network: 'BrightFit', name: 'BrightFit Абакан', city: 'Абакан', district: 'Абакан', address: 'Абакан', lat: 53.7205, lng: 91.4425 },
  { network: 'BrightFit', name: 'BrightFit Галактика', city: 'Калининград', district: 'Калининград', address: 'ТРЦ Галактика', lat: 54.7105, lng: 20.4525 },

  // ——— Extra Alex Fitness (popular mid-market) ———
  { network: 'Alex Fitness', name: 'Alex Fitness Пражская', city: 'Москва', district: 'Пражская', address: 'улица Кировоградская / район Пражская', lat: 55.6125, lng: 37.6055 },
  { network: 'Alex Fitness', name: 'Alex Fitness Речной вокзал', city: 'Москва', district: 'Речной вокзал', address: 'Ленинградское шоссе / Речной вокзал', lat: 55.8555, lng: 37.4755 },
  { network: 'Alex Fitness', name: 'Alex Fitness Щёлковская', city: 'Москва', district: 'Щёлковская', address: 'Щёлковское шоссе', lat: 55.8105, lng: 37.7985 },
  { network: 'Alex Fitness', name: 'Alex Fitness Беляево', city: 'Москва', district: 'Беляево', address: 'улица Профсоюзная / Беляево', lat: 55.6425, lng: 37.5255 },
  { network: 'Alex Fitness', name: 'Alex Fitness Новогиреево', city: 'Москва', district: 'Новогиреево', address: 'Зелёный проспект / Новогиреево', lat: 55.7515, lng: 37.8185 },
  { network: 'Alex Fitness', name: 'Alex Fitness Бутово', city: 'Москва', district: 'Бутово', address: 'Бутовский район', lat: 55.5485, lng: 37.5785 },
  { network: 'Alex Fitness', name: 'Alex Fitness Митино', city: 'Москва', district: 'Митино', address: 'Пятницкое шоссе / Митино', lat: 55.8455, lng: 37.3585 },
  { network: 'Alex Fitness', name: 'Alex Fitness Казань Тандем', city: 'Казань', district: 'Казань', address: 'ТРЦ Тандем', lat: 55.7985, lng: 49.1055 },

  // ——— Nebo / regional mid-size (selected high-traffic) ———
  { network: 'Nebo', name: 'Nebo Фитнес Академическая', city: 'Санкт-Петербург', district: 'Академическая', address: 'район Академическая', lat: 60.0125, lng: 30.3955 },
  { network: 'Nebo', name: 'Nebo Фитнес Комендантский', city: 'Санкт-Петербург', district: 'Комендантский', address: 'Комендантский проспект', lat: 60.0085, lng: 30.2585 },
  { network: 'Nebo', name: 'Nebo Фитнес Купчино', city: 'Санкт-Петербург', district: 'Купчино', address: 'Купчино', lat: 59.8515, lng: 30.3685 },
]

const PRIORITY = new Set([
  'Москва',
  'Санкт-Петербург',
  'Казань',
  'Екатеринбург',
  'Новосибирск',
  'Краснодар',
  'Самара',
  'Ростов-на-Дону',
  'Уфа',
  'Челябинск',
  'Воронеж',
  'Пермь',
  'Волгоград',
  'Красноярск',
  'Сочи',
  'Тюмень',
  'Иркутск',
  'Владивосток',
  'Калининград',
  'Кудрово',
  'Мурино',
])

const NETWORK_ORDER = [
  'DDX Fitness',
  'Spirit. Fitness',
  'World Class',
  'Encore Fitness',
  'Crocus Fitness',
  'XFIT',
  'Alex Fitness',
  'URBANFIT',
  'Fitness House',
  'BrightFit',
  'Nebo',
]

function buildCities(gyms) {
  /** @type {Map<string, {name:string,gymCount:number,networks:Set<string>}>} */
  const byCity = new Map()
  for (const g of gyms) {
    let row = byCity.get(g.city)
    if (!row) {
      row = { name: g.city, gymCount: 0, networks: new Set() }
      byCity.set(g.city, row)
    }
    row.gymCount += 1
    row.networks.add(g.network)
  }

  const list = [...byCity.values()].map((row) => ({
    name: row.name,
    gymCount: row.gymCount,
    networks: NETWORK_ORDER.filter((n) => row.networks.has(n)).concat(
      [...row.networks].filter((n) => !NETWORK_ORDER.includes(n)).sort(),
    ),
    priority: PRIORITY.has(row.name),
  }))

  list.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1
    if (a.priority && b.priority) {
      return [...PRIORITY].indexOf(a.name) - [...PRIORITY].indexOf(b.name)
    }
    return b.gymCount - a.gymCount || a.name.localeCompare(b.name, 'ru')
  })

  return list
}

const existing = JSON.parse(readFileSync(gymsPath, 'utf8'))
const byId = new Map(existing.map((g) => [g.id, g]))

let added = 0
for (const [i, raw] of RAW.entries()) {
  const id = makeId(raw.network, raw.name, raw.city)
  if (byId.has(id)) continue
  const stats = stableStats(id)
  byId.set(id, {
    id,
    name: raw.name,
    network: raw.network,
    city: raw.city,
    district: raw.district,
    address: raw.address,
    membersCount: stats.membersCount,
    activeNow: stats.activeNow,
    image: IMAGES[i % IMAGES.length],
    lat: raw.lat,
    lng: raw.lng,
  })
  added += 1
}

const gyms = [...byId.values()].sort((a, b) => {
  if (a.network !== b.network) return a.network.localeCompare(b.network, 'en')
  if (a.city !== b.city) return a.city.localeCompare(b.city, 'ru')
  return a.name.localeCompare(b.name, 'ru')
})

writeFileSync(gymsPath, `${JSON.stringify(gyms, null, 2)}\n`)
writeFileSync(citiesPath, `${JSON.stringify(buildCities(gyms), null, 2)}\n`)
copyFileSync(gymsPath, apiGymsPath)

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      networks: Object.fromEntries(
        NETWORK_ORDER.map((n) => [n, gyms.filter((g) => g.network === n).length]),
      ),
    },
    null,
    2,
  ),
)
