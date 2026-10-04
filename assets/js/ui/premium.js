/* Premium UI: shared page identity and graphics derived from real local data. */
window.P = window.P || {};
P.premium = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state;
  const LABELS = {
    overview: ['המבט שלך', 'החודש שלי'], welcome: ['מקום טוב להתחיל', 'פרוטה'], explore: ['כל מה שמאחורי המספרים', 'לחקור'],
    months: ['הסיפור לאורך זמן', 'חודשים'], categories: ['הבחירות שמרכיבות את החיים', 'קטגוריות'],
    transactions: ['כל פרט במקום', 'תנועות'], plan: ['מהבנה לפעולה', 'התוכנית'],
    insights: ['לזהות דפוסים. לבחור אחרת.', 'תובנות'], assign: ['נותנים לכל הוצאה מקום', 'לשיוך'],
    rules: ['דיוק שנבנה עם הזמן', 'כללי סיווג'], settings: ['מרגיש בדיוק שלך', 'הגדרות'], about: ['הסיפור של פרוטה', 'על פרוטה']
  };
  function eyebrow(name) { return (LABELS[name] || LABELS.overview)[0]; }
  function workspace(name) {
    const host = document.getElementById('workspace');
    if (!host || !P.app) return;
    const info = P.store.describe(), has = st.data.tx.length > 0;
    host.innerHTML = '';
    host.appendChild(el('div.workspace__inner', null, [
      el('div.workspace__location', null, [el('span', {text:'המרחב האישי'}), P.icons.svg('chevron',12),
        // בתוך "לחקור" — גם הדרך חזרה אליו
        P.pages.explore && P.pages.explore.ROUTES.indexOf(name) !== -1 ? [el('a', {href:'#/explore', text:'לחקור'}), P.icons.svg('chevron',12)] : null,
        el('b', {text:(LABELS[name] || LABELS.overview)[1]})]),
      el('div.workspace__actions', null, [
        el('a.workspace__privacy', {href:'#/settings', 'data-ok':!info.problem && info.mode !== 'memory' ? '1' : '0'}, [P.icons.svg('lock',13), info.problem || info.mode === 'memory' ? 'בדיקת שמירה' : 'מקומי ופרטי']),
        el('button.btn.btn--ghost', {type:'button', onclick:()=>P.palette.open(), 'aria-label':'חיפוש במרחב האישי'}, P.icons.svg('search',17)),
        has ? el('button.btn.btn--soft', {type:'button', onclick:()=>P.pages.plan.editor()}, [P.icons.svg('plus',15),'תנועה חדשה']) : null
      ])
    ]));
  }
  function svg(tag, attrs, children) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.keys(attrs).forEach(k=>node.setAttribute(k,attrs[k]));
    (children || []).forEach(c=>node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }
  /** A ring is explicitly a ratio, never a financial-health score. */
  function heroVisual(m) {
    const account = !st.spendOnly() && m.totals.inflow > 0;
    const largest = m.cats[0];
    if (!account && !largest) return null;
    const raw = account ? m.totals.outflow / m.totals.inflow : largest.sum / Math.max(1,m.totals.outflow);
    const pct = Math.round(raw*100), fraction = Math.min(1,Math.max(0,raw));
    const label = account ? 'מההכנסות הוצאו' : 'מההוצאות בקטגוריה המובילה';
    const circumference = 2*Math.PI*88;
    const ring = svg('svg', {viewBox:'0 0 220 220',class:'balance-orbit',role:'img','aria-label':pct+'% '+label}, [
      svg('title',null,[pct+'% '+label]),
      svg('circle',{cx:110,cy:110,r:102,fill:'none',stroke:'currentColor','stroke-opacity':'.08','stroke-width':1}),
      svg('circle',{cx:110,cy:110,r:88,fill:'none',stroke:'currentColor','stroke-opacity':'.14','stroke-width':7}),
      svg('circle',{cx:110,cy:110,r:88,fill:'none',stroke:raw>1?'#f1b195':'#d8e8b0','stroke-width':7,'stroke-linecap':'round',
        'stroke-dasharray':circumference,'stroke-dashoffset':circumference*(1-fraction),transform:'rotate(-90 110 110)',class:'balance-orbit__arc'}),
      svg('circle',{cx:110,cy:110,r:68,fill:'none',stroke:'currentColor','stroke-opacity':'.07','stroke-width':1})
    ]);
    return el('div.hero-visual',null,[
      el('div.hero-visual__dial',null,[ring,el('div.hero-visual__number',null,[el('b.fig',{text:pct+'%'}),el('span',{text:label})])]),
      el('div.hero-visual__note',null,[el('i'),el('span',{text:account ? (m.totals.net>=0?'הפער שנשאר: ':'הוצאות מעבר להכנסות: ')+fmt.money(Math.abs(m.totals.net)) : largest.cat})]),
      el('small',{text:m.cov.partial?'יחס לפי הדוח החלקי שנרשם':'יחס לפי הנתונים שנרשמו בחודש'})
    ]);
  }
  function nextStep(m) {
    const advice = P.pages.plan.advice(m)[0];
    const pending = m.expense.filter(t=>t.cat===P.cats.OTHER);
    const budgets = Object.keys(st.data.budgets).length;
    let title, copy, href, label, icon;
    if (advice) {
      title='נקודה אחת להתחיל ממנה'; copy=advice.title+' · פער של '+fmt.money(advice.amount)+'. פותחים את התנועות ובודקים מה השתנה.';
      href='#/plan?month='+m.key; label='לבדוק בתוכנית'; icon='target';
    } else if (pending.length) {
      title='קצת סדר, תמונה הרבה יותר ברורה';copy=fmt.plural(pending.length,'הוצאה','הוצאות','הוצאה אחת')+' בחודש הזה עדיין ללא קטגוריה. שיוך בתי העסק עוזר להבין לאן הכסף הולך.';
      href='#/assign';label='לסדר את הקטגוריות';icon='inbox';
    } else {
      title=budgets?'הצעד הבא נשאר בידיים שלך':'נותנים להוצאות כיוון';
      copy=budgets?'היעדים שלך כבר במקום. אפשר לבדוק את ההתקדמות ולבחור שינוי קטן לחודש הבא.':'אפשר להתחיל מקטגוריה אחת ולבחור עבורה תקציב שמתאים לחיים שלך.';
      href='#/plan?month='+m.key;label=budgets?'לתוכנית שלי':'לבחור יעד ראשון';icon='target';
    }
    return el('section.next-step',{'aria-label':'הצעד הבא'},[
      el('span.next-step__icon',null,P.icons.svg(icon,24)),
      el('div.next-step__copy',null,[el('span.next-step__eyebrow',{text:'צעד קטן. יותר שליטה.'}),el('h2',{text:title}),el('p',{text:copy})]),
      el('a.btn.btn--primary',{href},[label,P.icons.svg('chevron',15)])
    ]);
  }
  function monthStory(all) {
    const comparable = all.filter(m=>!st.coverage(m.key).partial);
    if (comparable.length<2) return null;
    const oldest=comparable[comparable.length-1],latest=comparable[0];
    const delta=latest.outflow-oldest.outflow;
    const sum=st.totals(st.counted());
    const path = [];
    const ordered=all.slice().reverse(),max=Math.max(1,...ordered.map(m=>m.outflow));
    ordered.forEach((m,i)=>path.push((i?'L':'M')+(8+i*284/Math.max(1,ordered.length-1)).toFixed(1)+' '+(71-m.outflow/max*55).toFixed(1)));
    const graphic=svg('svg',{viewBox:'0 0 300 86',class:'month-story__line','aria-hidden':'true'},[
      svg('path',{d:'M8 72H292',fill:'none',stroke:'currentColor','stroke-opacity':'.16','stroke-width':1}),
      svg('path',{d:path.join(' '),fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'})
    ]);
    return el('section.month-story',null,[el('div',null,[el('span.atlas__eyebrow',{text:'כל חודש מוסיף לסיפור'}),el('h2',{text:'רואים שינוי כשמסתכלים אחורה.'}),el('p',{text:fmt.monthName(latest.key)+' לעומת '+fmt.monthName(oldest.key)+': '+(Math.abs(delta)<1?'כמעט אותה הוצאה.':(delta>0?'עלייה':'ירידה')+' של '+fmt.money(Math.abs(delta))+' בהוצאה החודשית.')})]),el('div.month-story__graphic',null,[graphic,el('div',null,[el('span',{text:'סך ההוצאות בתקופה'}),el('b.fig',{text:fmt.money(sum.outflow)})])])]);
  }
  function categoryFocus(rows,total,flowOut,opts) {
    const top=rows.filter(c=>c.cat!==P.cats.OTHER).slice(0,3);
    if(!top.length)return null;
    return el('div.category-focus',null,top.map((c,i)=>el('button.category-focus__card',{
      type:'button',vars:{'--c':c.tint||c.color||st.tintOf(c.cat)},onclick:()=>P.views.category(c.cat,{month:opts && opts.month}),
      'aria-label':c.cat+', '+fmt.money(c.sum)+', '+Math.round(c.sum/total*100)+'%'
    },[
      el('div.category-focus__art',{'aria-hidden':'true'},[P.art.seal({seed:50+i*19,color:'currentColor',quality:'lo',width:.6,petals:8,cls:'category-focus__seal'}),P.art.tile(c.cat,56,c.tint)]),
      el('div.category-focus__content',null,[el('span',{text:i===0?'החלק הגדול ביותר':(i+1)+' / לפי היקף'}),el('h2',{text:c.cat}),el('b.fig',{text:fmt.money(c.sum)}),el('small',{text:fmt.pct(c.sum/total)+(flowOut?' מההוצאות':' מההכנסות')})]),
      P.icons.svg('chevron',16)
    ])));
  }
  function budgetRing(total,actual,has) {
    const ratio=total>0?Math.min(actual/total,1):actual>0?1:0;
    const ring=svg('svg',{viewBox:'0 0 132 132',class:'budget-orbit','aria-hidden':'true'},[
      svg('circle',{cx:66,cy:66,r:54,fill:'none',stroke:'currentColor','stroke-opacity':'.12','stroke-width':8}),
      svg('circle',{cx:66,cy:66,r:54,fill:'none',stroke:'currentColor','stroke-width':8,'stroke-linecap':'round','stroke-dasharray':339.29,'stroke-dashoffset':339.29*(1-ratio),transform:'rotate(-90 66 66)'})
    ]);
    return el('div.budget-overview__orbit',{'data-over':has&&actual>total?'1':'0'},[ring,el('b.fig',{text:has?(total>0?Math.round(actual/total*100)+'%':actual>0?'מעל היעד':'0%'):'—'})]);
  }
  function budgetOverview(targets,total,actual) {
    const has=targets.length>0, over=has&&actual>total;
    return el('section.budget-overview',null,[
      budgetRing(total,actual,has),el('div.budget-overview__intro',null,[el('span.atlas__eyebrow',{text:has?'היעדים שלך, במבט אחד':'התחלה קטנה עושה סדר'}),el('h2',{text:has?(over?'יש פער שכדאי לבדוק.':'יש מקום להמשיך בנחת.'):'עוד לא הוגדר תקציב.'}),el('p',{text:has?targets.length+' קטגוריות עם יעד חודשי. הסיכום מתייחס רק אליהן.':'הגדירו יעד בקטגוריה אחת או שתיים. אפשר לשנות אותו בכל רגע.'})]),
      el('div.budget-overview__stats',null,[['היעד החודשי',has?fmt.money(total):'—'],['יצא מול היעדים',has?fmt.money(actual):'—'],[over?'מעל היעדים':'יתרה מול היעדים',has?fmt.money(Math.abs(total-actual)):'—']].map(([label,value])=>el('div',null,[el('span',{text:label}),el('b.fig',{text:value})])))
    ]);
  }
  return {eyebrow,workspace,heroVisual,nextStep,monthStory,categoryFocus,budgetOverview};
})();
