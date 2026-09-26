export type FreeSurveyConfig={provider:string;responderUrl:string|null;status:string;privacySettingsVerified:boolean;publicationApproved:boolean;publishedFormVerified:boolean;confirmationDownloadUrl:string|null};
export function validGoogleResponderUrl(value:unknown):value is string{
 if(typeof value!=="string")return false;
 try{const u=new URL(value);return u.origin==="https://docs.google.com"&&!u.username&&!u.password&&!u.hash&&!u.search&&/^\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/.test(u.pathname);}catch{return false;}
}
export function freeSurveyReady(config:FreeSurveyConfig){
 if(!validGoogleResponderUrl(config.responderUrl)||config.provider!=="google_forms"||config.status!=="active"||!config.privacySettingsVerified||!config.publicationApproved||!config.publishedFormVerified)return false;
 try{const u=new URL(config.confirmationDownloadUrl??"");return u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==="/datasets/free-2020/download/";}catch{return false;}
}
export function freeSurveyEntryHref(config:FreeSurveyConfig){
 return freeSurveyReady(config)?config.responderUrl!:"/datasets/free-2020";
}
export const freeSurveyQuestions=[
 {title:"今後ほしいデータ（複数選択可）",required:true,options:["家庭用料金","経営指標","費用内訳","年度推移","料金改定","財務諸表","その他"]},
 {title:"利用目的（任意）",required:false,options:["業務資料","研究・学習","記事・説明資料","自分の地域の確認","その他"]},
 {title:"希望する年度・地域（任意）",required:false},
 {title:"追加してほしい項目や使いやすくする要望（任意）",required:false}
];
