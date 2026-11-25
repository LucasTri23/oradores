export default [{
  files:['assets/shared/auth-demo.js'],
  languageOptions:{ecmaVersion:2022,sourceType:'script',globals:Object.fromEntries(['window','document','module','globalThis','sessionStorage','performance','setTimeout','clearTimeout','IntersectionObserver','queueMicrotask'].map(key=>[key,'readonly']))},
  rules:{'no-undef':'error','no-unused-vars':'error','no-unreachable':'error','no-dupe-args':'error','no-dupe-keys':'error','no-eval':'error','no-implied-eval':'error','no-new-func':'error','eqeqeq':'error','no-constant-condition':'error','no-empty':['error',{allowEmptyCatch:true}]},
}];
