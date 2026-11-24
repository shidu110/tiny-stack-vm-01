import * as fs from 'node:fs';
const spec=[];
for(const [base,text] of [[0,'000101401010012022023033'],[16,'021021021021021021021011021021021011021021021'],[32,'021021021'],[48,'200210210200000'],[64,'011020'],[80,'010010001010']])
  text.match(/.../g).forEach((v,i)=>spec[+base+i]=[...v].map(Number));

export function run(p:Uint8Array,input:Uint8Array){
  const s=[],c=[],m=new Int32Array(256),out=[];
  let pc=0,ip=0,steps=0;
  const done=(exit,trap=exit)=>({stdout:Buffer.from(out),exit,trap,steps});
  for(;;){
    if(steps===1000000)return done(10);
    if(pc<0||pc>=p.length)return done(9);
    const op=p[pc],rule=spec[op];
    if(!rule)return done(5);
    const [imm,pops,pushes]=rule;
    if(pc+imm>=p.length)return done(9);
    steps++;
    if(s.length<pops)return done(2);
    if(s.length-pops+pushes>256)return done(3);
    pc+=1+imm;
    let a=s[s.length-1],b=s[s.length-2];
    if(op>=16&&op<=34){
      if(op>=19&&op<=22&&!a)return done(4);
      s.length-=pops;
      s.push([b+a,b-a,Math.imul(b,a),b/a,b%a,
        (b>>>0)/(a>>>0),(b>>>0)%(a>>>0),-a,b&a,b|a,b^a,~a,
        b<<a,b>>a,b>>>a,0,+(b===a),+(b<a),+((b>>>0)<(a>>>0))][op-16]|0);
      continue;
    }
    switch(op){
      case 0:return done(0,null);
      case 1:s.push(p[pc-1]<<24>>24);break;
      case 2:s.push(p[pc-4]|p[pc-3]<<8|p[pc-2]<<16|p[pc-1]<<24);break;
      case 3:s.pop();break;
      case 4:s.push(a);break;
      case 5:s.splice(-2,2,a,b);break;
      case 6:s.push(b);break;
      case 7:s.splice(-3,3,b,a,s.at(-3));break;
      case 48:case 49:case 50:
        if(op===48||(op===49)===(s.pop()===0))pc+=(p[pc-2]|p[pc-1]<<8)<<16>>16;
        break;
      case 51:
        if(c.length===64)return done(7);
        c.push(pc);pc=p[pc-2]|p[pc-1]<<8;break;
      case 52:
        if(!c.length)return done(8);
        pc=c.pop();break;
      case 64:case 65:
        if(a<0||a>=256)return done(6);
        if(op===64)s[s.length-1]=m[a];
        else{m[a]=b;s.length-=2;}
        break;
      case 80:case 81:{
        const bytes=op===80?Buffer.from(''+a):[a&255];
        if(out.length+bytes.length>65536)return done(11);
        s.pop();for(const byte of bytes)out.push(byte);
        break;
      }
      case 82:s.push(ip<input.length?input[ip++]:-1);break;
      case 83:return done(s.pop()&255,null);
    }
  }
}

const src=process.env.MAKEFUN_INPUT_DIR??'/input',dst=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of fs.readdirSync(src).sort()){
  const read=name=>fs.readFileSync(`${src}/${id}/${name}.bin`);
  const r=run(read('program'),read('input')),dir=`${dst}/${id}`;
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(dir+'/stdout.bin',r.stdout);
  fs.writeFileSync(dir+'/exit.txt',r.exit+'\n');
}
