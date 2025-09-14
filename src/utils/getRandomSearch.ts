export const getRandomSearch = () => {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  
  const randomCharacter = characters.charAt(Math.floor(Math.random() * characters.length));
  let randomSearch = '';

  switch (Math.round(Math.random())) {
    case 0:
      randomSearch = randomCharacter + '%';
      break;
    case 1:
      randomSearch = '%' + randomCharacter + '%';
      break;
  }

  return randomSearch;
}