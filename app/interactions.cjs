const MENU_ACTIONS=Object.freeze([
 ['tailtap','尾巴连拍三下'],['shy','害羞一下'],['pet','摸摸脑袋'],['wave','挥挥圆手'],
 ['jump','蹦一下'],['dance','摇摇摆摆'],['think','想一想'],['boop','戳戳鼻尖'],['walk','散步一小段'],['sleep','小憩一会儿'],['wake','醒醒，蓝色大肥鱼']
]);
function createPetCombo(){let count=0,lastAt=-Infinity;return{touch(now){count=now>=lastAt&&now-lastAt<=2000?Math.min(10,count+1):1;lastAt=now;return{count,angry:count>=10};},reset(){count=0;lastAt=-Infinity;}};}
module.exports={MENU_ACTIONS,createPetCombo};
