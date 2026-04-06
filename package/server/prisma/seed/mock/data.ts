import { faker } from "@faker-js/faker/locale/zu_ZA";

// https://www.amazon.com/amz-books/store
const book_cover_urls = [
  "https://m.media-amazon.com/images/I/91RwHjXkO6L._SY466_.jpg",
  "https://m.media-amazon.com/images/I/91pqP1xMb2L._SY466_.jpg",
  "https://m.media-amazon.com/images/I/81af+MCATTL._SY466_.jpg",
  "https://m.media-amazon.com/images/I/916tVbg-fHL._SY425_.jpg",
  "https://m.media-amazon.com/images/I/81OthjkJBuL._SY466_.jpg",
  "https://m.media-amazon.com/images/I/91bYsX41DVL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81iqZ2HHD-L._SY445_.jpg",
  "https://m.media-amazon.com/images/I/71KilybDOoL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81gepf1eMqL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81af+MCATTL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/91uwocAMtSL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81YOuOGFCJL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81qPmP18mYL._SY466_.jpg",
  "https://m.media-amazon.com/images/I/A1LumMU72HL._SY425_.jpg",
  "https://m.media-amazon.com/images/I/91-qSkyts4L._SY466_.jpg",
  "https://m.media-amazon.com/images/I/91Y94CZ-X3L._SY425_.jpg",
];

const press_user_names = [
  "起点中文网",
  "晋江文学城",
  "纵横中文网",
  "菠萝包",
  "红袖添香",
  "潇湘书院",
  "微信读书",
];

const producer_user_names = [
  "阅文集团",
  "腾讯文学",
  "百度文学",
  "阿里文学",
  "网易文学",
  "搜狐文学",
  "凤凰文学",
];

export function getRandomBookCover() {
  return faker.helpers.arrayElement(book_cover_urls);
}

export function getRandomPressUserName() {
  return faker.helpers.arrayElement(press_user_names);
}

export function getRandomProducerUserName() {
  return faker.helpers.arrayElement(producer_user_names);
}
