/* Explainable budgeting, no service calls or remote model. */
window.P = window.P || {};
P.pages = P.pages || {};
P.pages.plan = (function () {
  'use strict';
  const el = P.kit.el, st = P.state, fmt = P.fmt;
  let key = null;
  function localDate() { const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function simulator(m) {
    const flexible=['מסעדות וקפה','בילויים ופנאי','קניות וביגוד','מנויים ודיגיטל'];
    const cats=m.cats.filter(c=>flexible.includes(c.cat));
    if(!cats.length)return null;
    const sum=cats.reduce((n,c)=>n+c.sum,0);
    const slider=el('input',{type:'range',min:5,max:30,step:5,value:10,'aria-label':'אחוז צמצום בתרחיש'});
    const value=el('b.fig',{'aria-live':'polite'}), detail=el('p'), percent=el('span');
    const draw=()=>{percent.textContent='צמצום נבחר: '+slider.value+'%';slider.setAttribute('aria-valuetext',slider.value+' אחוזי צמצום');value.textContent=fmt.money(sum*Number(slider.value)/100);detail.textContent='צמצום של '+slider.value+'% מתוך '+fmt.money(sum)+' בקטגוריות: '+cats.map(c=>c.cat).join(', ')+'.';};
    slider.addEventListener('input',draw);draw();
    return el('section.plan-simulator',null,[el('div',null,[el('span.atlas__eyebrow',{text:'בודקים אפשרות, בלי להתחייב'}),el('h2',{text:'מה אם נצמצם קצת?'}),detail,el('small',{text:'תרחיש המבוסס על ההוצאות בדוח החודש שנבחר, גם אם הוא חלקי. אינו תחזית או חיסכון מובטח. אין שינוי בתקציבים.'})]),el('div.plan-simulator__control',null,[el('span',{text:'הפחתה אפשרית ביחס לסכום שנרשם'}),value,slider,percent])]);
  }
  function advice(m) {
    const items = [];
    m.cats.forEach(c => {
      const budget = st.data.budgets[c.cat];
      if (budget !== undefined && c.sum > budget) items.push({cat:c.cat, amount:c.sum - budget, title:'חריגה מהתקציב · ' + c.cat, text:'יצאו ' + fmt.money(c.sum) + ' מול יעד של ' + fmt.money(budget) + '. הפער הוא ' + fmt.money(c.sum-budget) + '. כדאי לעבור על התנועות ולבחור הוצאה שאפשר לצמצם או לעדכן יעד שאינו מציאותי.'});
      if (!m.cov.partial && m.base.months >= 2 && c.avg >= 100 && c.sum >= c.avg * 1.3 && c.sum-c.avg >= 200) items.push({cat:c.cat, amount:c.sum-c.avg, title:'שינוי בולט · ' + c.cat, text:'עלייה של ' + Math.round((c.sum/c.avg-1)*100) + '%: ' + fmt.money(c.sum) + ' לעומת ממוצע ' + fmt.money(c.avg) + ' ב-' + m.base.months + ' חודשים קודמים עם כיסוי של 90% לפחות. כדאי לבדוק אם זו הוצאה חד־פעמית, חיוב כפול או הרגל שהשתנה.'});
    });
    return items.sort((a,b)=>b.amount-a.amount).slice(0,5);
  }
  function adviceCards(m) {
    const items = advice(m);
    return el('div.plan-advice', null, items.length ? items.map(a => el('article.plan-tip', null, [P.icons.svg('spark',20), el('div', null, [el('h3', {text:a.title}), el('p', {text:a.text}), el('button.btn.btn--sm', {type:'button', onclick:()=>P.views.category(a.cat,{month:m.key})}, 'לבדוק את ההוצאות')])])) : el('article.plan-tip', null, [P.icons.svg('check',20), el('div', null, [el('h3', {text:'מתחילים מתמונה ברורה'}), el('p', {text:m.cov.partial ? 'זהו חודש חלקי. נציג חריגות מתקציב שכבר התרחשו, אך לא נשווה חודש חלקי לחודש מלא.' : 'לא זוהו חריגות לפי התקציבים והספים שלנו. הגדירו יעדים, או הוסיפו דוחות כדי לאפשר השוואה רחבה יותר.'})]) ]));
  }
  function quick(m) {
    return el('section.local-guide', null, [P.icons.svg('sliders',24), el('div',null,[el('b',{text:'מלהבין את הכסף, לתכנן אותו.'}),el('p',{text:advice(m).length ? advice(m).length+' נקודות שכדאי לבדוק בתוכנית החודשית שלך.' : 'קובעים תקציב אישי, מזהים שינויים ובוחרים את הצעד הבא.'})]),el('a.btn.btn--primary',{href:'#/plan?month='+m.key},'לתוכנית שלי')]);
  }
  function budgetEditor(cat) {
    const current=st.data.budgets[cat];
    const input=el('input.input',{type:'number',min:0,max:1e9,step:0.01,value:current===undefined?'':current,required:true,'aria-label':'תקציב חודשי בשקלים'});
    let dialog;
    const form=el('form.plan-form',{onsubmit:e=>{e.preventDefault();if(!form.reportValidity())return;st.setBudget(cat,Number(input.value));dialog.close();P.kit.toast('התקציב נשמר');}},[
      el('p',{text:'יעד חודשי קבוע בשקלים. הוא חל על כל החודשים עד שתשנו אותו; 0 הוא יעד של אפס הוצאות.'}),el('label',null,['תקציב חודשי',input]),
      el('div.plan-actions',null,[el('button.btn.btn--primary',{type:'submit'},'שמירת יעד'),el('button.btn',{type:'button',onclick:()=>{st.setBudget(cat,null);dialog.close();}},'הסרת יעד')])]);
    dialog=P.ui.dialog({title:cat,body:form});setTimeout(()=>input.focus(),100);
  }
  function editor(t) {
    const desc=el('input.input',{value:t?t.desc:'',required:true,maxlength:400,'aria-label':'תיאור'});
    const date=el('input.input',{type:'date',value:t?t.date:localDate(),required:true,'aria-label':'תאריך'});
    const amount=el('input.input',{type:'number',min:0.01,max:1e9,step:0.01,value:t?Math.abs(t.amount):'',required:true,'aria-label':'סכום'});
    const direction=el('select.input',{'aria-label':'סוג תנועה'},[el('option',{value:'-1'},'הוצאה'),el('option',{value:'1'},'הכנסה')]);direction.value=t&&t.amount>0?'1':'-1';
    const category=el('select.input',{'aria-label':'קטגוריה'},Object.keys(st.data.rules).map(c=>el('option',{value:c,text:c})));category.value=t?t.cat:P.cats.OTHER;
    let dialog;
    const form=el('form.plan-form',{onsubmit:e=>{
      e.preventDefault();if(!form.reportValidity())return;
      if(!desc.value.trim()||P.parse.date(date.value)!==date.value){P.kit.toast('יש למלא תיאור ותאריך תקינים');return;}
      const patch={desc:desc.value.trim(),date:date.value,amount:Number(amount.value)*Number(direction.value)};
      if(t) st.editTransaction(t.id,patch);
      else { patch.id='manual-'+(crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2));patch.currency='₪';patch.balance=null;patch.ref='';st.addTransactions([patch],{},'תנועה ידנית'); }
      st.assign(t?t.id:patch.id,category.value);dialog.close();P.kit.toast(t?'התנועה עודכנה':'התנועה נוספה');
    }},[
      t?el('p',{text:'השינוי מעדכן את הניתוח המקומי. שינוי סכום או תאריך מסיר את היתרה המקורית מהתנועה הזו.'}):el('p',{text:'הוספת תנועה ידנית בשקלים. אם היא מופיעה גם בדוח הבנק, אין להוסיף אותה שוב.'}),
      el('label',null,['תיאור',desc]),el('div.plan-fields',null,[el('label',null,['תאריך',date]),el('label',null,['סכום'+(t?' ('+t.currency+')':' (₪)'),amount])]),
      el('div.plan-fields',null,[el('label',null,['סוג',direction]),el('label',null,['קטגוריה',category])]),
      el('div.plan-actions',null,[el('button.btn.btn--primary',{type:'submit'},'שמירה'),t?el('button.btn.btn--danger',{type:'button',onclick:()=>P.kit.confirmBox('למחוק את התנועה?','התנועה תוסר מהניתוח המקומי. אפשר לשחזר מגיבוי או לייבא שוב את הדוח.','מחיקה',()=>{st.removeTransactions([t.id]);P.router.go('#/transactions');P.kit.toast('התנועה נמחקה');},true)},'מחיקת תנועה'):null])
    ]);
    dialog=P.ui.dialog({title:t?'עריכת תנועה':'תנועה חדשה',body:form});setTimeout(()=>desc.focus(),100);
  }
  function render(params,mount) {
    const months=st.months();if(params.month&&months.some(m=>m.key===params.month))key=params.month;
    if(!key||!months.some(m=>m.key===key))key=P.insights.focusMonth();
    mount.appendChild(el('header.plan-heading',null,[el('div',null,[el('span.page-eyebrow',{text:'מהבנה לפעולה'}),el('h1',{text:'התוכנית שלי'}),el('p',{text:'יעדים ברורים, שינויים שכדאי להבין וצעד קטן שאפשר לעשות היום.'})]),el('button.btn.btn--primary',{type:'button',onclick:()=>editor()},'+ הוספת תנועה')]));
    if(!months.length){mount.appendChild(el('p',{text:'הוסיפו תנועה או טענו דוח כדי להתחיל לתכנן.'}));return;}
    const m=P.insights.month(key);
    const select=el('select.input',{'aria-label':'חודש לתכנון'},months.map(mm=>el('option',{value:mm.key,text:fmt.monthName(mm.key)})));select.value=key;select.addEventListener('change',()=>{key=select.value;P.router.go('#/plan?month='+key);});
    mount.appendChild(el('div.plan-toolbar',null,[select,el('span',{text:'היעדים חודשיים וקבועים · הסכומים לפי הדוחות שנטענו'})]));
    mount.appendChild(adviceCards(m));
    const scenario=simulator(m);if(scenario)mount.appendChild(scenario);
    const names=Object.keys(st.data.rules).filter(c=>c!=='הכנסות'&&!st.data.excluded[c]);
    const spent=Object.fromEntries(m.cats.map(c=>[c.cat,c.sum]));
    names.sort((a,b)=>(spent[b]||0)-(spent[a]||0));
    const targets=names.filter(c=>st.data.budgets[c]!==undefined),total=targets.reduce((s,c)=>s+st.data.budgets[c],0),actual=targets.reduce((s,c)=>s+(spent[c]||0),0);
    mount.appendChild(P.premium.budgetOverview(targets,total,actual));
    mount.appendChild(el('div.plan-budgets',null,names.map(cat=>{
      const value=spent[cat]||0,b=st.data.budgets[cat],has=b!==undefined,over=has&&value>b;
      return el('article.plan-budget',{'data-status':has?(over?'over':'within'):'unset'},[el('div.plan-budget__head',null,[P.art.tile(cat,32,st.tintOf(cat)),el('h3',{text:cat}),el('button.btn.btn--sm',{type:'button',onclick:()=>budgetEditor(cat)},has?'עריכת יעד':'הגדרת יעד')]),el('div.plan-budget__value',null,[el('b.fig',{text:fmt.money(value)}),el('span',{text:has?'מתוך '+fmt.money(b):'ללא יעד חודשי'})]),el('span.plan-budget__status',{text:has?(over?'מעל היעד':'בתוך היעד'):'לבחירתך'}),el('div.plan-meter',{'aria-hidden':'true'},el('i',{style:'width:'+ (has?(b>0?Math.min(100,value/b*100):value?100:0):0)+'%;background:'+(over?'var(--neg)':'var(--accent)')})),el('p',{text:has?(over?'חריגה של '+fmt.money(value-b):'עוד '+fmt.money(b-value)+' עד היעד'):'אפשר להתחיל מיעד שמתאים להוצאות הרגילות שלך.'}),el('button.card__more',{type:'button',onclick:()=>P.views.category(cat,{month:key})},'לראות ולערוך תנועות')]);
    })));
    mount.appendChild(el('p.plan-method',{text:'איך ההצעות מחושבות? חריגה היא הוצאה מעל יעד שהגדרת. שינוי בולט הוא עלייה של לפחות 30% וגם ₪200, לעומת לפחות שני חודשים קודמים עם כיסוי של 90% ומעלה וממוצע של ₪100 לפחות. אין השוואת מגמות בחודש חלקי. אלה הצעות לתכנון הוצאות המבוססות על הדוחות, לא זיהוי ודאי של חיוב שגוי. חיוב אשראי מרוכז אינו מגלה מה נקנה — לשם כך צריך את פירוט הכרטיס.'}));
  }
  return {render,editor,advice,quick,title:'התוכנית שלי',needsData:false};
})();
