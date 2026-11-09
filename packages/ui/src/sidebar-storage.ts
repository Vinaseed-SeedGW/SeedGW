export const SIDEBAR_STORAGE_KEY = 'dms.sidebar.v1';

// Chay truoc khi trang duoc ve de sidebar khong bi nhay khi tai lai.
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='collapsed'){document.documentElement.dataset.sidebar='collapsed'}}catch(e){}`;
