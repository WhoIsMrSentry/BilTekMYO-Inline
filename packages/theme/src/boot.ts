import { themes } from './registry';

export const storageKey = 'biltekmyo-palette';

/** Runs before first paint. A ?theme= link wins and is remembered, so a screen can be set by URL. */
export const themeBootScript = `try{var d=document.documentElement,k='${storageKey}',a=${JSON.stringify(themes.map((theme) => theme.id))},q=new URLSearchParams(location.search).get('theme'),s=localStorage.getItem(k),t=a.indexOf(q)>=0?q:a.indexOf(s)>=0?s:d.dataset.palette;d.dataset.palette=t;if(t===q)localStorage.setItem(k,t)}catch(e){}`;
