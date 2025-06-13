import './ExamplesPanel.css';

const EXAMPLES = [
  { name: 'Scale', content: `1 2 3 4 | 5 6 7 1' | 2' 3' 4' 5' | 6' 7' 1'' - |` },
  { name: 'Twinkle Twinkle', content: 
`title: "一闪一闪小星星"
subtitle: "英国童谣"
tempo: "180"
=
1155|665-|4433|221-|
5544|332-|5544|332-|
1155|665-|4433|221-|` },
  { name: 'Ode to Joy', content: 
`title: "欢乐颂"
subtitle: "Ode to Joy"
composer: "贝多芬"
key: "D"
tempo: "96"
=
3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3. 2/ 2 - |` },
  { name: 'Jingle Bells', content: 
`title: "Jingle Bell"
subtitle: "铃儿响叮当"
composer: "皮尔庞特"
tempo: "110"
key: "F"
=
3/ 3/ 3 3/ 3/ 3 | 3/ 5/ 1./ 2// 3. 0/ |
4/ 4/ 4./ 4// 4/ 3/ 3/ 3// 3// | 3/ 2/ 2/ 1/ 2 5|
3/ 3/ 3 3/ 3/ 3 | 3/ 5/ 1./ 2// 3. 0/ |
4/ 4/ 4./ 4// 4/ 3/ 3/ 3// 3// | 5/ 5/ 4/ 2/ 1. 0/|` },
  { name: 'Happy Birthday', content: 
`title: "生日快乐"
subtitle: "Happy Birthday"
key: "E"
time: "3/4"
tempo: "96"
=
005,/5,/|6,5,1|7,-5,/5,/|6,5,2|
1-5,/5,/|531|7,6,4/4/|312|1--|
` },
  { name: "6/8 Example", content:
`title: "我和我的祖国"
subtitle: "6/8拍示例"
composer: "秦咏诚"
key: "Eb"
time: "6/8"
tempo: "164"
=
5/6/5/4/3/2/|1.5,.|1/3/1'/7/6/3/|5--|
6/7/6/5/4/3/|2.6,.|7,/6,/5,/5/1./2//|3--|
5/6/5/4/3/2/|1.5,.|1/3/1'/7/2'./1'//|6--|
1'/7/6/5.|6/5/4/3.|7,6,/5,2/|1--|
`
  },
  { name: 'Burning Field', content: 
`title: "Burning Field"
subtitle: "S3-OP"
composer: "鸡排ZOPN"
tempo: "150"
=
0 0 0 6/ 7/ | 1' - - 3' | 7 - 5 - | 7/ 1'/ 7/ 5/ 0/ 2/ 5 | 
3 - - 2/ 3/ | 4 - ~4/ 5/ 6/ 1'/ | 7 - 5 - | 6/ 7/ 1'/ 2'/ 0/ 1'/ 2' | 
3' - - 6/ 7/ | 1' - - 3' | 7 - 5 - | 7/ 1'/ 2'/ 3'/ 0/ 5'/ 6' | 
3' - - 2'/ 3'/ | 4'/ 3'/ 2'/ 1'/ ~1' 1'/ 7/ | 3'/ 2'/ 1'/ 7/ ~7 - | 6/ 7/ 1'/ 3'/ 0/ 5'/ ~5'/ 3'/ | 
6' - - - |` 
  },
  { name: 'Blocky Heroes', content: 
`title: "Blocky Heroes"
subtitle: "BSMC-OP1"
composer: "鸡排ZOPN" 
key: "D#" 
tempo: "85"
=
3//0//3//0//#2//0//2//0//%2//0//1//0//6,//6,//5,//6,//|0000|
3//0//3//0//#2//0//2//0//%2//0//1//0//2//2//#2//3//|0000|
,6//5//6/~6./6//6//7//7.|6,//7,//1/~1./1//2//3//3/2//0//2//6,//|
~6,//6,/.~6,/3/2/1/7,/1/|7,./6,//6,-0/6/|
3'.1'/2'3'|#2'//6//6//6//0//6//0//6//3'//#5//6//6//0/%5/|
6.7//1'//7./1'./2'/|3'/.2'./1'/3'0/6/|
3'.1'/2'3'|3'//2'//1'//7//0//1'//0//7//60/5/|
6.3'/2'/.7/.1'/|3/.5./6/~6-|`
  },
  { name: 'Shining from the Underground', content: 
`title: "Shining from the Underground"
subtitle: "BSMCF-OP"
composer: "鸡排ZOPN"
tempo: "135"
=
'' 2' 1'/. 1'//~ 1' 6// 5// 4/ |'' 5/. 6//~ 6/ 2/~ 2 - |'' 2' 1'/. 1'//~ 1' 6// 5// 4/ | 5'' - - - | 2' - - - |
,, 6/. 1'/. 6/. 2'/. 5/. 4// |,, 4/ 1'/ 7/ 6// 5// 5/ 2'/ 3' |,, 6/. 1'/. 6/. 2'/. 5/. 4// |,, 4/ 1'/ 7/ 6// 5// 5/ 5/ 6 |
,, 6/. 1'/. 6/. 2'/. 5/. 4// |,, 4/ 1'/ 7/ 6// 5// 5/ 2'/ 3' |,, 6/. 1'/. 6/. 2'/. 5/. 4// | 4,,/ 1,/ 7,,/ 6,,// 5,,// 2' 5// 6// 7// 1'// |
2' 1'/. 1'//~ 1' 6// 5// 4/ | 5/. 6//~ 6/ 2/~ 2 - | 2' 1'/. 1'//~ 1' 6// 5// 4/ | 5/. 4//~ 4/ 6/~ 6 - |
2' 1'/. 1'//~ 1' 6// 5// 4/ | 5/. 6//~ 6/ 2/~ 2 1/ 4/ | 3~ 3/ 2/~ 2 1/ 4/| 5 ~5/6/~6 - |
2' 1'/. 1'//~ 1' 6// 5// 4/ | 5/. 6//~ 6/ 2/~ 2 - | 2' 1'/. 1'//~ 1' 6// 3'// 4'/ | 3'/. 1'//~ 1'/ 6/~ 6 - |
2' 1'/. 1'//~ 1' 6// 5// 4/ | 5/. 6//~ 6/ 2/~ 2 1/ 4/ | 3~ 3/ 2/~ 2 1/ 4/ | 2/. 3//~3/ 4/ 5/.6//~6/ 1'/| 2' --- |`
  },
];

function ExamplesPanel({ isOpen, onClose, onSelectExample }) {
  if (!isOpen) return null;
  
  return (
    <div className="examples-panel">
      <div className="examples-panel-header">
        <h3>Choose an Example</h3>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>
      <div className="examples-list">
        {EXAMPLES.map((example, index) => (
          <button 
            key={index} 
            onClick={() => onSelectExample(example.content)}
            className="example-item"
          >
            {example.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ExamplesPanel;