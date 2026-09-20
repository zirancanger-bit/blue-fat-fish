const lines={
 welcome:['蓝色大肥鱼来啦。桌角借我一小块。','圆手和尾巴都带来了。'],
 tailtap:['啪啪啪！三下，一口气。','我用尾巴敲门啦。'],tail:['尾巴有自己的节拍。'],
 shy:['……别一直看。','圆手挡一下，脸有点热。','我、我才没有害羞。'],
 pet:['嗯……再摸一下也可以。','手很暖。'],boop:['啵。这里会害羞的。'],
 wave:['在呢。圆手举起来了。'],jump:['轻轻跳一下。'],star:['给你一点亮晶晶。'],
 dance:['拍子交给尾巴。'],walk:['去旁边转一小圈。'],sleep:['我眯一会儿，醒了还在。'],wake:['醒啦，刚梦见海浪。'],
 think:['我陪你慢慢想。'],smile:['今天的好心情，分你一点。'],angry:['哼，摸太多啦。'],cool:['嗯。看见你了。'],
 drag:['尾、尾巴不是提手……！'],settle:['呼，脚终于朝下了。'],
 idle:['尾巴占的地方也算座位。','安静看守你的桌角。']};
export function pickLine(key){const a=lines[key]||lines.wave;return a[Math.floor(Math.random()*a.length)];}
