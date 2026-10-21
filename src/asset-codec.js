function fromB64(b64){let raw=atob(b64),buf=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)buf[i]=raw.charCodeAt(i);return URL.createObjectURL(new Blob([buf],{type:'image/webp'}))}
export { fromB64 };
