// Small, dependency-free ZIP STORE writer. No compression; filenames are UTF-8.
const table = Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
export async function zipStore(entries){
  const parts=[],central=[];let offset=0;const encoder=new TextEncoder();
  for(const [name,value] of entries){
    const filename=encoder.encode(name),data=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):typeof value==='string'?encoder.encode(value):new Uint8Array(value.buffer??value,value.byteOffset??0,value.byteLength??value.length);
    const crc=crc32(data),header=new Uint8Array(30),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,filename.length,true);
    parts.push(header,filename,data);
    const ch=new Uint8Array(46),c=new DataView(ch.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);central.push(ch,filename);offset+=30+filename.length+data.length;
  }
  const size=central.reduce((s,a)=>s+a.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
