export function choices(text, options, title='xirax 6.1', buttonText='Selecionar') {
 if(!options.length||options.length>10)throw Error('A lista deve ter de 1 a 10 opções.');
 return {kind:'choices',title,buttonText,text,options:options.map(o=>({id:String(o.id),title:String(o.title),description:o.description?String(o.description):''}))};
}
export function choiceText(value){if(typeof value==='string')return value;return value.text+'\n\n'+value.options.map((o,i)=>`${i+1} — ${o.title}`).join('\n')+'\n\nToque em Selecionar ou responda com o número da opção.';}
export function extractText(message){
 const outer=message?.ephemeralMessage?.message||message;
 const m=outer?.viewOnceMessage?.message||outer?.viewOnceMessageV2?.message||outer;
 if(!m)return '';
 if(m.conversation||m.extendedTextMessage?.text)return m.conversation||m.extendedTextMessage.text;
 const selected=m.listResponseMessage?.singleSelectReply?.selectedRowId||m.buttonsResponseMessage?.selectedButtonId||m.templateButtonReplyMessage?.selectedId;
 if(selected)return selected;
 const json=m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
 if(json){try{const data=JSON.parse(json);const id=data.id||data.selectedId||data.selected_row_id;return typeof id==='string'?id:'';}catch{return '';}}
 return '';
}
