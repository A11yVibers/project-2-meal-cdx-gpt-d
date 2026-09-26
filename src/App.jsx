import { useEffect, useMemo, useState } from 'react'
import { APPROVED_IMAGES } from './approved-images'
import recipesCsv from '../project-assets/recipes.csv?raw'
import cuisinesCsv from '../project-assets/cuisines.csv?raw'
import mealTypesCsv from '../project-assets/meal_types.csv?raw'
import dietaryCsv from '../project-assets/dietary_tags.csv?raw'
import categoriesCsv from '../project-assets/recipe_categories.csv?raw'
import ingredientsCsv from '../project-assets/ingredients.csv?raw'
import unitsCsv from '../project-assets/units.csv?raw'
import recipeIngredientsCsv from '../project-assets/recipe_ingredients.csv?raw'
import recipeStepsCsv from '../project-assets/recipe_steps.csv?raw'

const Icon = ({ name, size = 18 }) => {
  const paths = {
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h7"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    basket: <><path d="m5 10 2 10h10l2-10M3 10h18M9 10l3-7 3 7"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, people: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 6a3 3 0 0 1 0 6M18 14c2 .7 3 2.7 3 6"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>, back: <path d="m15 18-6-6 6-6"/>, close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></>, grip: <><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>, upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 15v5h14v-5"/></>, sliders: <><path d="M4 6h5M15 6h5M4 12h10M18 12h2M4 18h2M12 18h8"/><circle cx="12" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++ }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [headers, ...data] = rows
  return data.map(values => Object.fromEntries(headers.map((header, i) => [header.trim(), (values[i] || '').trim()])))
}

const csv = {
  recipes: parseCsv(recipesCsv), cuisines: parseCsv(cuisinesCsv), mealTypes: parseCsv(mealTypesCsv),
  dietary: parseCsv(dietaryCsv), categories: parseCsv(categoriesCsv), ingredients: parseCsv(ingredientsCsv),
  units: parseCsv(unitsCsv), recipeIngredients: parseCsv(recipeIngredientsCsv), steps: parseCsv(recipeStepsCsv),
}
const byId = (list, idKey, nameKey, id) => list.find(x => x[idKey] === id)?.[nameKey] || id
const seedRecipes = csv.recipes.map(r => ({
  id: r.recipe_id, title: r.title, description: r.short_description, sourceName: r.source_name, sourceUrl: r.source_url,
  servings: +r.servings, prep: +r.prep_time_minutes, cook: +r.cook_time_minutes, total: +r.total_time_minutes,
  cuisine: byId(csv.cuisines, 'cuisine_id', 'cuisine_name', r.cuisine_id), mealType: byId(csv.mealTypes, 'meal_type_id', 'meal_type_name', r.meal_type_id),
  dietary: r.dietary_tag_ids.split(',').filter(Boolean).map(id => byId(csv.dietary, 'dietary_tag_id', 'dietary_tag_name', id)),
  categories: r.category_ids.split(',').filter(Boolean).map(id => byId(csv.categories, 'category_id', 'category_name', id)),
  spice: +r.spice_level_0_to_5, accent: r.accent_color, image: r.cover_image_url || APPROVED_IMAGES.placeholder,
  suggestions: r.include_in_meal_suggestions === 'true', includeShopping: true, showNutrition: false, substitutions: true, measurements: 'US customary',
  ingredients: csv.recipeIngredients.filter(i => i.recipe_id === r.recipe_id).map(i => ({ id: `${r.recipe_id}-${i.display_order}`, section: i.section_name, ingredientId: i.ingredient_id, name: i.ingredient_name, quantity: i.quantity, unit: i.unit, notes: i.notes, optional: i.optional.toLowerCase() === 'true' })),
  steps: csv.steps.filter(s => s.recipe_id === r.recipe_id).map(s => ({ id: `${r.recipe_id}-s${s.step_number}`, instruction: s.instruction, timer: +s.timer_minutes || '' })),
}))

const storage = {
  get(key, fallback) { try { const v = localStorage.getItem(`hearth-${key}`); return v ? JSON.parse(v) : fallback } catch { return fallback } },
  set(key, value) { try { localStorage.setItem(`hearth-${key}`, JSON.stringify(value)) } catch { /* local storage unavailable */ } }
}
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const planMeals = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const categoryOrder = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Grains & pantry', 'Oils & condiments', 'Canned & jarred', 'Spices']
const mondayOf = (date = new Date()) => { const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }
const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` }
const dateFrom = (week, offset) => { const d = new Date(`${week}T12:00:00`); d.setDate(d.getDate() + offset); return d }
const formatWeek = week => { const start = dateFrom(week, 0), end = dateFrom(week, 6); return `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` }
const emptyIngredient = (section = 'Main') => ({ id: crypto.randomUUID(), section, ingredientId: '', name: '', quantity: '', unit: '', notes: '', optional: false })
const emptyStep = () => ({ id: crypto.randomUUID(), instruction: '', timer: '' })

function Toggle({ checked, onChange, label, description }) {
  return <label className="toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><button type="button" role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><i /></button></label>
}

function Header({ view, setView, openForm }) {
  return <header className="site-header">
    <button className="brand" onClick={() => setView('recipes')}><span className="brand-mark">H</span><span>Hearth &amp; Table<small>MEAL PLANNING, MADE LOVELY</small></span></button>
    <nav>
      <button className={view === 'recipes' ? 'active' : ''} onClick={() => setView('recipes')}><Icon name="book"/>Recipes</button>
      <button className={view === 'planner' ? 'active' : ''} onClick={() => setView('planner')}><Icon name="calendar"/>Meal planner</button>
      <button className={view === 'shopping' ? 'active' : ''} onClick={() => setView('shopping')}><Icon name="basket"/>Shopping list</button>
    </nav>
    <button className="primary add-recipe" onClick={openForm}><Icon name="plus"/> Add recipe</button>
  </header>
}

function RecipeCard({ recipe, onOpen, onPlan }) {
  return <article className="recipe-card" onClick={onOpen} style={{'--accent': recipe.accent}}>
    <div className="card-image"><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={e => { e.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><span className="meal-pill">{recipe.mealType}</span><button className="quick-add" title="Add to meal plan" onClick={e => { e.stopPropagation(); onPlan(recipe) }}><Icon name="calendar" size={17}/></button></div>
    <div className="card-body"><div className="eyebrow">{recipe.cuisine} · {recipe.categories?.[0] || 'Homestyle'}</div><h3>{recipe.title}</h3><p>{recipe.description}</p>
      <div className="card-meta"><span><Icon name="clock" size={16}/>{recipe.total} min</span><span><Icon name="people" size={16}/>{recipe.servings} servings</span><span className="view-link">View recipe <Icon name="arrow" size={15}/></span></div>
    </div>
  </article>
}

function Catalog({ recipes, setSelected, openForm, quickPlan }) {
  const [query, setQuery] = useState(''); const [meal, setMeal] = useState('All meals')
  const visible = recipes.filter(r => (meal === 'All meals' || r.mealType === meal) && `${r.title} ${r.cuisine} ${r.categories.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <main className="page catalog-page">
    <section className="hero"><div><p className="kicker">YOUR RECIPE COLLECTION</p><h1>What will you cook<br/><em>this week?</em></h1><p>Gather the recipes you love, then turn them into a week of good meals.</p></div><div className="hero-art"><span>Fresh ideas,<br/>beautifully planned.</span></div></section>
    <section className="catalog-heading"><div><h2>All recipes <span>{visible.length}</span></h2><p>Your kitchen library, ready whenever inspiration strikes.</p></div><div className="catalog-tools"><label className="search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search recipes…"/></label><select value={meal} onChange={e=>setMeal(e.target.value)}><option>All meals</option>{csv.mealTypes.map(m=><option key={m.meal_type_id}>{m.meal_type_name}</option>)}</select></div></section>
    <section className="recipe-grid">{visible.map(r=><RecipeCard key={r.id} recipe={r} onOpen={()=>setSelected(r)} onPlan={quickPlan}/>)}
      <button className="new-card" onClick={openForm}><span><Icon name="plus" size={25}/></span><strong>Add your own recipe</strong><small>Build something delicious</small></button>
    </section>
  </main>
}

function RecipeDetail({ recipe, onBack, onPlan }) {
  const sections = [...new Set(recipe.ingredients.map(i=>i.section))]
  return <main className="detail-page">
    <button className="text-button back" onClick={onBack}><Icon name="back"/>Back to recipes</button>
    <section className="detail-hero" style={{'--accent': recipe.accent}}><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={e=>{e.currentTarget.src=APPROVED_IMAGES.placeholder}} alt=""/><div><p className="eyebrow">{recipe.cuisine} · {recipe.mealType}</p><h1>{recipe.title}</h1><p className="detail-description">{recipe.description}</p><div className="tag-row">{recipe.dietary.map(t=><span key={t}>{t}</span>)}</div><div className="detail-stats"><span><small>PREP</small><strong>{recipe.prep} min</strong></span><span><small>COOK</small><strong>{recipe.cook} min</strong></span><span><small>TOTAL</small><strong>{recipe.total} min</strong></span><span><small>SERVES</small><strong>{recipe.servings}</strong></span></div><button className="primary" onClick={()=>onPlan(recipe)}><Icon name="calendar"/>Add to meal plan</button></div></section>
    <section className="recipe-content"><div className="ingredients-panel"><p className="kicker">WHAT YOU'LL NEED</p><h2>Ingredients</h2>{sections.map(section=><div className="ingredient-section" key={section}><h3>{section}</h3>{recipe.ingredients.filter(i=>i.section===section).map(i=><div className="ingredient-line" key={i.id}><span>{i.quantity} {i.unit}</span><strong>{i.name}</strong>{i.notes && <small>{i.notes}</small>}{i.optional && <em>optional</em>}</div>)}</div>)}</div>
      <div className="method-panel"><p className="kicker">HOW TO MAKE IT</p><h2>Method</h2>{recipe.steps.map((s,i)=><div className="method-step" key={s.id}><b>{i+1}</b><div><p>{s.instruction}</p>{s.timer && <span><Icon name="clock" size={15}/>{s.timer} min</span>}</div></div>)}</div></section>
  </main>
}

function SlotModal({ slot, recipes, onClose, onAssign, onRemove }) {
  const [query, setQuery] = useState('')
  const filtered = recipes.filter(r=>r.title.toLowerCase().includes(query.toLowerCase()))
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="slot-modal"><button className="icon-btn modal-close" onClick={onClose}><Icon name="close"/></button><p className="kicker">{slot.dayLabel} · {slot.meal}</p><h2>{slot.recipeId ? 'Replace this meal' : 'Choose a recipe'}</h2><label className="search"><Icon name="search"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your recipes…"/></label><div className="modal-recipes">{filtered.map(r=><button key={r.id} onClick={()=>onAssign(r.id)}><img src={r.image || APPROVED_IMAGES.placeholder} alt=""/><span><strong>{r.title}</strong><small>{r.total} min · {r.cuisine}</small></span><Icon name="arrow"/></button>)}</div>{slot.recipeId&&<button className="danger-link" onClick={onRemove}><Icon name="trash"/>Remove from plan</button>}</section></div>
}

function Planner({ recipes, plan, setPlan, week, setWeek, initialRecipe, clearInitial }) {
  const [slot, setSlot] = useState(null)
  useEffect(()=>{ if(initialRecipe){ setSlot({date:iso(dateFrom(week,0)),meal:initialRecipe.mealType in Object.fromEntries(planMeals.map(x=>[x,1]))?initialRecipe.mealType:'Dinner',dayLabel:dayNames[0],recipeId:null,preselect:initialRecipe.id}); clearInitial() } },[initialRecipe])
  const moveWeek = n => setWeek(iso(dateFrom(week,n*7)))
  const assign = id => { setPlan({...plan,[`${slot.date}|${slot.meal}`]:id}); setSlot(null) }
  return <main className="page planner-page"><section className="page-title"><div><p className="kicker">WEEKLY RHYTHM</p><h1>Meal planner</h1><p>A gentle plan for a delicious week.</p></div><div className="week-nav"><button onClick={()=>moveWeek(-1)}><Icon name="back"/></button><strong>{formatWeek(week)}</strong><button onClick={()=>moveWeek(1)}><Icon name="arrow"/></button><button className="today-btn" onClick={()=>setWeek(iso(mondayOf()))}>Today</button></div></section>
    <div className="planner-grid">{dayNames.map((day,idx)=>{const date=iso(dateFrom(week,idx)), d=dateFrom(week,idx), today=date===iso(new Date()); return <section className={`day-column ${today?'today':''}`} key={day}><header><span>{day.slice(0,3)}</span><b>{d.getDate()}</b>{today&&<small>TODAY</small>}</header><div>{planMeals.map(meal=>{const recipeId=plan[`${date}|${meal}`], recipe=recipes.find(r=>r.id===recipeId); return <button className={`meal-slot ${recipe?'filled':''}`} key={meal} onClick={()=>setSlot({date,meal,dayLabel:day,recipeId})} style={recipe?{'--accent':recipe.accent}:{}}><small>{meal}</small>{recipe?<><strong>{recipe.title}</strong><span>{recipe.total} min</span></>:<><i><Icon name="plus" size={15}/></i><span>Add meal</span></>}</button>})}</div></section>})}</div>
    <p className="planner-note"><span>Tip</span> Select any meal slot to add, replace, or remove a recipe. Your plan saves automatically.</p>
    {slot&&<SlotModal slot={slot} recipes={recipes} onClose={()=>setSlot(null)} onAssign={assign} onRemove={()=>{const next={...plan};delete next[`${slot.date}|${slot.meal}`];setPlan(next);setSlot(null)}}/>}
  </main>
}

function Shopping({ recipes, plan, checked, setChecked, pantry, setPantry, week }) {
  const [hidePantry, setHidePantry] = useState(true)
  const plannedIds = Object.entries(plan).filter(([key])=>key.split('|')[0]>=week&&key.split('|')[0]<=iso(dateFrom(week,6))).map(([,id])=>id)
  const items = useMemo(()=>{
    const combined = new Map()
    plannedIds.forEach(id=>{const r=recipes.find(x=>x.id===id); if(!r?.includeShopping)return; r.ingredients.forEach(i=>{const key=`${i.name}|${i.unit}`.toLowerCase();const n=parseFloat(i.quantity);if(combined.has(key)&&!Number.isNaN(n)&&!Number.isNaN(parseFloat(combined.get(key).quantity)))combined.get(key).quantity=String(parseFloat(combined.get(key).quantity)+n);else if(!combined.has(key))combined.set(key,{...i,key,category:csv.ingredients.find(x=>x.ingredient_id===i.ingredientId)?.shopping_category||'Grains & pantry'})})})
    return [...combined.values()]
  },[recipes,plan,week])
  const visible=items.filter(i=>!hidePantry||!pantry[i.key]); const done=visible.filter(i=>checked[i.key]).length
  return <main className="page shopping-page"><section className="page-title"><div><p className="kicker">GATHER WHAT YOU NEED</p><h1>Shopping list</h1><p>Built automatically from your plan for {formatWeek(week)}.</p></div><div className="list-progress"><span>{done} of {visible.length} gathered</span><div><i style={{width:visible.length?`${done/visible.length*100}%`:'0%'}}/></div></div></section>
    <div className="shopping-layout"><section className="shopping-list">{items.length===0?<div className="empty-state"><span><Icon name="basket" size={30}/></span><h2>Your basket is waiting</h2><p>Add recipes to this week's meal plan and their ingredients will appear here.</p></div>:categoryOrder.map(cat=>{const group=visible.filter(i=>i.category===cat);if(!group.length)return null;return <div className="shop-category" key={cat}><h2>{cat}<span>{group.length}</span></h2>{group.map(item=><div className={`shop-item ${checked[item.key]?'done':''}`} key={item.key}><button className="check-box" onClick={()=>setChecked({...checked,[item.key]:!checked[item.key]})}>{checked[item.key]&&<Icon name="check" size={15}/>}</button><strong>{item.name}</strong><span>{item.quantity} {item.unit}</span>{item.optional&&<em>optional</em>}<button className="pantry-btn" onClick={()=>setPantry({...pantry,[item.key]:true})}>I have this</button></div>)}</div>})}</section>
      <aside className="pantry-card"><span className="aside-icon"><Icon name="basket"/></span><h3>Pantry check</h3><p>Hide items you already have at home from this week's list.</p><Toggle label="Hide pantry items" checked={hidePantry} onChange={setHidePantry}/><div className="pantry-items">{Object.keys(pantry).filter(k=>pantry[k]).length?<><small>IN YOUR PANTRY</small>{Object.keys(pantry).filter(k=>pantry[k]).map(k=><button key={k} onClick={()=>setPantry({...pantry,[k]:false})}>{k.split('|')[0]} <Icon name="close" size={13}/></button>)}</>:<small>No items marked yet</small>}</div></aside>
    </div>
  </main>
}

function MultiChoice({ options, selected, setSelected }) {
  return <div className="choice-grid">{options.map(o=><button type="button" key={o} className={selected.includes(o)?'selected':''} onClick={()=>setSelected(selected.includes(o)?selected.filter(x=>x!==o):[...selected,o])}>{selected.includes(o)&&<Icon name="check" size={14}/>} {o}</button>)}</div>
}

function RecipeForm({ onClose, onSave, week }) {
  const [form,setForm]=useState({title:'',sourceUrl:'',description:'',cuisine:'',mealType:'Dinner',dietary:[],categories:[],servings:4,prep:15,cook:30,spice:2,accent:'#D97757',imageName:'',suggestions:true,addNow:false,planWeek:week,planDate:iso(dateFrom(week,0)),planMeal:'Dinner',planTime:'18:30',includeShopping:true,showNutrition:false,substitutions:true,measurements:'US customary',ingredients:[emptyIngredient()],steps:[emptyStep()]})
  const [sectionName,setSectionName]=useState(''); const [showOptions,setShowOptions]=useState(false); const [error,setError]=useState('')
  const update=(key,val)=>setForm(f=>({...f,[key]:val})); const patchIngredient=(id,key,val)=>update('ingredients',form.ingredients.map(i=>i.id===id?{...i,[key]:val,...(key==='ingredientId'?{name:csv.ingredients.find(x=>x.ingredient_id===val)?.ingredient_name||''}:{})}:i))
  const move=(key,index,dir)=>{const list=[...form[key]],to=index+dir;if(to<0||to>=list.length)return;[list[index],list[to]]=[list[to],list[index]];update(key,list)}
  const submit=e=>{e.preventDefault();if(!form.title.trim()){setError('Give your recipe a title before saving.');document.querySelector('#recipe-title')?.focus();return}if(!form.ingredients.some(i=>i.name)){setError('Add at least one ingredient.');return}if(!form.steps.some(s=>s.instruction.trim())){setError('Add at least one method step.');return}onSave({...form,id:`U-${Date.now()}`,total:Number(form.prep)+Number(form.cook),image:APPROVED_IMAGES.placeholder,description:form.description||'A treasured recipe from your own kitchen.',sourceName:form.sourceUrl?'Original source':'My kitchen'})}
  const sections=[...new Set(form.ingredients.map(i=>i.section))]
  return <div className="form-shell"><header className="form-header"><button className="brand" onClick={onClose}><span className="brand-mark">H</span><span>Hearth &amp; Table<small>MEAL PLANNING, MADE LOVELY</small></span></button><div><span>New recipe</span><button className="icon-btn" onClick={onClose}><Icon name="close"/></button></div></header>
    <form onSubmit={submit}><section className="form-intro"><button type="button" className="text-button" onClick={onClose}><Icon name="back"/>Back to recipes</button><p className="kicker">ADD TO YOUR COLLECTION</p><h1>Create a new recipe</h1><p>Capture the details now, enjoy the recipe for years to come.</p></section>
    <div className="form-layout"><div className="form-main">
      <FormSection number="01" title="Recipe details" subtitle="The essentials that make this recipe yours."><div className="field full"><label htmlFor="recipe-title">Recipe title *</label><input id="recipe-title" value={form.title} onChange={e=>update('title',e.target.value)} placeholder="e.g. Sunday lemon roast chicken"/></div><div className="field full"><label>Short description</label><textarea value={form.description} onChange={e=>update('description',e.target.value)} placeholder="What makes this recipe special?"/></div><div className="field full"><label>Source link</label><input type="url" value={form.sourceUrl} onChange={e=>update('sourceUrl',e.target.value)} placeholder="https://…"/></div><div className="two-col"><div className="field"><label>Cuisine</label><select value={form.cuisine} onChange={e=>update('cuisine',e.target.value)}><option value="">Select cuisine</option>{csv.cuisines.map(x=><option key={x.cuisine_id}>{x.cuisine_name}</option>)}</select></div><div className="field"><label>Primary meal type</label><select value={form.mealType} onChange={e=>update('mealType',e.target.value)}>{csv.mealTypes.map(x=><option key={x.meal_type_id}>{x.meal_type_name}</option>)}</select></div></div><div className="field full"><label>Dietary suitability</label><MultiChoice options={csv.dietary.map(x=>x.dietary_tag_name)} selected={form.dietary} setSelected={v=>update('dietary',v)}/></div><div className="field full"><label>Recipe categories</label><MultiChoice options={csv.categories.map(x=>x.category_name)} selected={form.categories} setSelected={v=>update('categories',v)}/></div></FormSection>
      <FormSection number="02" title="Timing & yield" subtitle="Help future you know what to expect."><div className="timing-grid"><div className="field"><label>Servings</label><div className="stepper"><button type="button" onClick={()=>update('servings',Math.max(1,form.servings-1))}>−</button><input type="number" min="1" value={form.servings} onChange={e=>update('servings',+e.target.value)}/><button type="button" onClick={()=>update('servings',form.servings+1)}>+</button></div></div><div className="field"><label>Prep time</label><div className="unit-input"><input type="number" min="0" value={form.prep} onChange={e=>update('prep',e.target.value)}/><span>min</span></div></div><div className="field"><label>Cook time</label><div className="unit-input"><input type="number" min="0" value={form.cook} onChange={e=>update('cook',e.target.value)}/><span>min</span></div></div><div className="field"><label>Total time</label><div className="total-time"><Icon name="clock"/>{Number(form.prep)+Number(form.cook)} min</div></div></div><div className="field full"><label>Spice level <span>{['Mild','Gentle','Medium','Hot','Very hot','Fiery'][form.spice]}</span></label><div className="spice-control"><input type="range" min="0" max="5" value={form.spice} onChange={e=>update('spice',+e.target.value)}/><div>{['Mild','', 'Medium','','','Very spicy'].map((x,i)=><span key={i}>{x}</span>)}</div></div></div></FormSection>
      <FormSection number="03" title="Image & appearance" subtitle="Give your recipe a place in the spotlight."><div className="upload-zone"><Icon name="upload" size={25}/><strong>{form.imageName||'Choose a cover image'}</strong><span>JPG or PNG · Used for your personal recipe</span><input type="file" accept="image/png,image/jpeg" onChange={e=>update('imageName',e.target.files?.[0]?.name||'')}/></div><div className="field full"><label>Recipe card accent</label><div className="swatches">{['#D97757','#D4A847','#788D69','#517C78','#7C6688','#B86B72'].map(c=><button type="button" key={c} className={form.accent===c?'selected':''} style={{background:c}} onClick={()=>update('accent',c)}>{form.accent===c&&<Icon name="check"/>}</button>)}</div></div></FormSection>
      <FormSection number="04" title="Ingredients" subtitle="Organize ingredients into helpful groups.">{sections.map(section=><div className="ingredient-group" key={section}><div className="group-title"><h3>{section}</h3><span>{form.ingredients.filter(i=>i.section===section).length} items</span></div>{form.ingredients.map((ing,index)=>ing.section===section&&<div className="ingredient-row" key={ing.id}><button type="button" className="grip" title="Move up" onClick={()=>move('ingredients',index,-1)}><Icon name="grip"/></button><div className="field ingredient-search"><label>Ingredient</label><input list="ingredient-options" value={ing.name} onChange={e=>{const found=csv.ingredients.find(x=>x.ingredient_name===e.target.value);update('ingredients',form.ingredients.map(i=>i.id===ing.id?{...i,name:e.target.value,ingredientId:found?.ingredient_id||''}:i))}} placeholder="Search ingredient"/></div><div className="field qty"><label>Quantity</label><input value={ing.quantity} onChange={e=>patchIngredient(ing.id,'quantity',e.target.value)} placeholder="1"/></div><div className="field unit"><label>Unit</label><select value={ing.unit} onChange={e=>patchIngredient(ing.id,'unit',e.target.value)}><option value="">—</option>{csv.units.map(u=><option key={u.unit_id}>{u.unit_name}</option>)}</select></div><label className="optional"><input type="checkbox" checked={ing.optional} onChange={e=>patchIngredient(ing.id,'optional',e.target.checked)}/>Optional</label><button type="button" className="icon-btn remove" onClick={()=>update('ingredients',form.ingredients.filter(i=>i.id!==ing.id))}><Icon name="trash"/></button></div>)}<button type="button" className="subtle-button" onClick={()=>update('ingredients',[...form.ingredients,emptyIngredient(section)])}><Icon name="plus"/>Add ingredient</button></div>)}<datalist id="ingredient-options">{csv.ingredients.map(i=><option key={i.ingredient_id} value={i.ingredient_name}/>)}</datalist><div className="new-section"><input value={sectionName} onChange={e=>setSectionName(e.target.value)} placeholder="New section name (e.g. Garnish)"/><button type="button" className="secondary" onClick={()=>{if(sectionName.trim()){update('ingredients',[...form.ingredients,emptyIngredient(sectionName.trim())]);setSectionName('')}}}><Icon name="plus"/>Add section</button></div></FormSection>
      <FormSection number="05" title="Method" subtitle="Tell the story of how it comes together.">{form.steps.map((step,index)=><div className="step-row" key={step.id}><b>{index+1}</b><div className="field"><label>Instruction</label><textarea value={step.instruction} onChange={e=>update('steps',form.steps.map(s=>s.id===step.id?{...s,instruction:e.target.value}:s))} placeholder="Describe this step…"/></div><div className="field timer"><label>Timer</label><div className="unit-input"><input type="number" min="0" value={step.timer} onChange={e=>update('steps',form.steps.map(s=>s.id===step.id?{...s,timer:e.target.value}:s))} placeholder="—"/><span>min</span></div></div><div className="step-actions"><button type="button" onClick={()=>move('steps',index,-1)}>↑</button><button type="button" onClick={()=>move('steps',index,1)}>↓</button><button type="button" onClick={()=>update('steps',form.steps.filter(s=>s.id!==step.id))}><Icon name="trash"/></button></div></div>)}<button type="button" className="secondary" onClick={()=>update('steps',[...form.steps,emptyStep()])}><Icon name="plus"/>Add step</button></FormSection>
      <FormSection number="06" title="Meal planning" subtitle="Decide how this recipe joins your weekly rhythm."><Toggle label="Available in meal-plan suggestions" description="Show this recipe when choosing meals." checked={form.suggestions} onChange={v=>update('suggestions',v)}/><Toggle label="Add to my meal plan now" description="Choose exactly when you'd like to serve it." checked={form.addNow} onChange={v=>update('addNow',v)}/>{form.addNow&&<div className="planning-fields"><div className="field"><label>Planning week</label><input type="date" value={form.planWeek} onChange={e=>update('planWeek',iso(mondayOf(`${e.target.value}T12:00:00`)))}/></div><div className="field"><label>Cooking date</label><input type="date" min={form.planWeek} max={iso(dateFrom(form.planWeek,6))} value={form.planDate} onChange={e=>update('planDate',e.target.value)}/></div><div className="field"><label>Meal slot</label><select value={form.planMeal} onChange={e=>update('planMeal',e.target.value)}>{planMeals.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>Serving time</label><input type="time" value={form.planTime} onChange={e=>update('planTime',e.target.value)}/></div></div>}</FormSection>
    </div><aside className="form-aside"><div className="options-card"><button type="button" className="options-title" onClick={()=>setShowOptions(!showOptions)}><span><Icon name="sliders"/><strong>Recipe options</strong></span><span>{showOptions?'−':'+'}</span></button>{showOptions&&<div className="options-body"><Toggle label="Include in shopping lists" checked={form.includeShopping} onChange={v=>update('includeShopping',v)}/><Toggle label="Show nutrition information" checked={form.showNutrition} onChange={v=>update('showNutrition',v)}/><Toggle label="Allow substitutions" checked={form.substitutions} onChange={v=>update('substitutions',v)}/><div className="measurement"><label>Measurements</label>{['US customary','Metric'].map(x=><button type="button" className={form.measurements===x?'selected':''} key={x} onClick={()=>update('measurements',x)}><i>{form.measurements===x&&<span/>}</i>{x}</button>)}</div></div>}</div><div className="save-card"><p>Your recipe will be saved to this browser and added to your collection.</p>{error&&<div className="form-error">{error}</div>}<button className="primary wide" type="submit">Save recipe <Icon name="arrow"/></button><button className="text-button centered" type="button" onClick={onClose}>Cancel</button></div></aside></div></form>
  </div>
}

function FormSection({number,title,subtitle,children}) { return <section className="form-section"><header><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header><div className="form-section-body">{children}</div></section> }

export default function App() {
  const [view,setView]=useState('recipes'), [selected,setSelected]=useState(null), [showForm,setShowForm]=useState(false)
  const [userRecipes,setUserRecipes]=useState(()=>storage.get('recipes',[])), [plan,setPlan]=useState(()=>storage.get('plan',{})), [checked,setChecked]=useState(()=>storage.get('checked',{})), [pantry,setPantry]=useState(()=>storage.get('pantry',{}))
  const [week,setWeek]=useState(()=>iso(mondayOf())), [quickRecipe,setQuickRecipe]=useState(null); const recipes=[...seedRecipes,...userRecipes]
  useEffect(()=>storage.set('recipes',userRecipes),[userRecipes]); useEffect(()=>storage.set('plan',plan),[plan]); useEffect(()=>storage.set('checked',checked),[checked]); useEffect(()=>storage.set('pantry',pantry),[pantry])
  const go=v=>{setView(v);setSelected(null)}
  const quickPlan=r=>{setQuickRecipe(r);setView('planner');setSelected(null)}
  const saveRecipe=r=>{setUserRecipes([...userRecipes,r]);if(r.addNow){setPlan({...plan,[`${r.planDate}|${r.planMeal}`]:r.id});setWeek(r.planWeek)}setShowForm(false);setView(r.addNow?'planner':'recipes')}
  if(showForm)return <RecipeForm onClose={()=>setShowForm(false)} onSave={saveRecipe} week={week}/>
  return <><Header view={view} setView={go} openForm={()=>setShowForm(true)}/>{selected?<RecipeDetail recipe={selected} onBack={()=>setSelected(null)} onPlan={quickPlan}/>:view==='recipes'?<Catalog recipes={recipes} setSelected={setSelected} openForm={()=>setShowForm(true)} quickPlan={quickPlan}/>:view==='planner'?<Planner recipes={recipes} plan={plan} setPlan={setPlan} week={week} setWeek={setWeek} initialRecipe={quickRecipe} clearInitial={()=>setQuickRecipe(null)}/>:<Shopping recipes={recipes} plan={plan} checked={checked} setChecked={setChecked} pantry={pantry} setPantry={setPantry} week={week}/>}<footer><span>Hearth &amp; Table</span><p>Made for slow Sundays and busy Tuesdays.</p></footer></>
}
