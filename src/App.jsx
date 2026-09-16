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

const parseCsv = (text) => {
  const rows = []; let row = []; let value = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++ }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(value); value = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ''
    } else value += char
  }
  if (value || row.length) { row.push(value); rows.push(row) }
  const [headers, ...data] = rows
  return data.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])))
}

const lookups = {
  cuisines: parseCsv(cuisinesCsv), mealTypes: parseCsv(mealTypesCsv), dietary: parseCsv(dietaryCsv),
  categories: parseCsv(categoriesCsv), ingredients: parseCsv(ingredientsCsv), units: parseCsv(unitsCsv)
}
const byId = (list, idKey, nameKey, id) => list.find(x => x[idKey] === id)?.[nameKey] || id
const seedIngredients = parseCsv(recipeIngredientsCsv)
const seedSteps = parseCsv(recipeStepsCsv)
const seedRecipes = parseCsv(recipesCsv).map(r => ({
  ...r, servings: +r.servings, prep: +r.prep_time_minutes, cook: +r.cook_time_minutes,
  spice: +r.spice_level_0_to_5, cuisine: byId(lookups.cuisines, 'cuisine_id', 'cuisine_name', r.cuisine_id),
  mealType: byId(lookups.mealTypes, 'meal_type_id', 'meal_type_name', r.meal_type_id),
  dietary: r.dietary_tag_ids.split(',').map(id => byId(lookups.dietary, 'dietary_tag_id', 'dietary_tag_name', id)),
  categories: r.category_ids.split(',').map(id => byId(lookups.categories, 'category_id', 'category_name', id)),
  ingredients: seedIngredients.filter(i => i.recipe_id === r.recipe_id).map(i => ({ ...i, quantity: +i.quantity, optional: i.optional.toLowerCase() === 'true' })),
  steps: seedSteps.filter(s => s.recipe_id === r.recipe_id).map(s => ({ instruction: s.instruction, timer: +s.timer_minutes })),
  includeShopping: true, suggestions: r.include_in_meal_suggestions === 'true', image: r.cover_image_url,
  description: r.short_description, accent: r.accent_color, source: r.source_url || r.source_name, measurement: 'us'
}))

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const SLOTS = ['Breakfast','Lunch','Dinner','Snack']
const SHOP_ORDER = ['Produce','Meat & seafood','Dairy & eggs','Grains & pantry','Oils & condiments','Canned & jarred','Spices']
const ICONS = {
  recipes: 'M4 3h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V3Zm4 0v16M8 7h5M8 11h5',
  planner: 'M5 4h14v16H5zM8 2v4M16 2v4M5 9h14',
  shopping: 'M4 5h2l2 10h8l2-7H7M9 20h.01M16 20h.01',
  plus: 'M12 5v14M5 12h14', search: 'm21 21-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  clock: 'M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', chef: 'M7 10v10h10V10M9 15h6M7 10a4 4 0 1 1 2-7 4 4 0 0 1 6 0 4 4 0 1 1 2 7Z',
  close: 'm6 6 12 12M18 6 6 18', chevron: 'm9 18 6-6-6-6', trash: 'M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6'
}
function Icon({ name, size = 20 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]} /></svg> }
const mondayOf = (date = new Date()) => { const d = new Date(date); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); d.setHours(0,0,0,0); return d }
const keyDate = d => d.toISOString().slice(0,10)
const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }

export default function App() {
  const [view, setView] = useState('recipes')
  const [userRecipes, setUserRecipes] = useState(() => readLocal('mise-user-recipes', []))
  const [plan, setPlan] = useState(() => readLocal('mise-plan', {}))
  const [checked, setChecked] = useState(() => readLocal('mise-shopping-checked', {}))
  const [pantry, setPantry] = useState(() => readLocal('mise-pantry-hidden', false))
  const [week, setWeek] = useState(mondayOf())
  const [selected, setSelected] = useState(null)
  const [slotModal, setSlotModal] = useState(null)
  const recipes = useMemo(() => [...seedRecipes, ...userRecipes], [userRecipes])
  useEffect(() => localStorage.setItem('mise-user-recipes', JSON.stringify(userRecipes)), [userRecipes])
  useEffect(() => localStorage.setItem('mise-plan', JSON.stringify(plan)), [plan])
  useEffect(() => localStorage.setItem('mise-shopping-checked', JSON.stringify(checked)), [checked])
  useEffect(() => localStorage.setItem('mise-pantry-hidden', JSON.stringify(pantry)), [pantry])
  const go = v => { setView(v); setSelected(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const assign = (date, slot, recipeId) => { const key = `${date}|${slot}`; setPlan(p => ({ ...p, [key]: recipeId })); setSlotModal(null) }
  const removeSlot = (date, slot) => { const key = `${date}|${slot}`; setPlan(p => { const n = {...p}; delete n[key]; return n }) }
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => go('recipes')} aria-label="Mise home"><span className="brand-mark">M</span><span>Mise</span></button>
      <nav>{[['recipes','recipes','Recipes'],['planner','planner','Meal Planner'],['shopping','shopping','Shopping List']].map(([id,icon,label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => go(id)}><Icon name={icon}/>{label}</button>)}</nav>
      <button className="primary header-add" onClick={() => go('new')}><Icon name="plus" size={18}/> Add recipe</button>
    </header>
    <main>
      {view === 'recipes' && !selected && <Catalog recipes={recipes} onOpen={setSelected} onAdd={() => go('new')} />}
      {view === 'recipes' && selected && <RecipeDetail recipe={recipes.find(r => r.recipe_id === selected)} onBack={() => setSelected(null)} onPlan={() => setSlotModal({ recipeId: selected })} />}
      {view === 'new' && <RecipeForm onCancel={() => go('recipes')} onSave={(r, planning) => { setUserRecipes(x => [...x, r]); if (planning?.date) assign(planning.date, planning.slot, r.recipe_id); go('recipes') }} />}
      {view === 'planner' && <Planner week={week} setWeek={setWeek} plan={plan} recipes={recipes} setSlotModal={setSlotModal} removeSlot={removeSlot} onShopping={() => go('shopping')} />}
      {view === 'shopping' && <Shopping recipes={recipes} plan={plan} week={week} checked={checked} setChecked={setChecked} pantry={pantry} setPantry={setPantry} />}
    </main>
    {slotModal && <SlotModal data={slotModal} week={week} recipes={recipes} onClose={() => setSlotModal(null)} onAssign={assign} />}
  </div>
}

function Catalog({ recipes, onOpen, onAdd }) {
  const [query, setQuery] = useState(''); const [meal, setMeal] = useState('All meals')
  const filtered = recipes.filter(r => (r.title + r.description + r.cuisine).toLowerCase().includes(query.toLowerCase()) && (meal === 'All meals' || r.mealType === meal))
  return <div className="page catalog-page">
    <section className="hero"><div><p className="eyebrow">YOUR KITCHEN, ORGANIZED</p><h1>What’s cooking?</h1><p>Keep your favorite recipes close and make every week delicious.</p></div><div className="hero-art"><span>✦</span><span className="plate">◉</span><span>⌁</span></div></section>
    <div className="section-heading"><div><h2>Recipe collection</h2><p>{recipes.length} recipes ready to cook</p></div><button className="primary" onClick={onAdd}><Icon name="plus" size={18}/> New recipe</button></div>
    <div className="filters"><label className="search"><Icon name="search" size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipes, ingredients, cuisine…"/></label><select value={meal} onChange={e => setMeal(e.target.value)}><option>All meals</option>{lookups.mealTypes.map(x => <option key={x.meal_type_id}>{x.meal_type_name}</option>)}</select></div>
    <div className="recipe-grid">{filtered.map(r => <article className="recipe-card" key={r.recipe_id} onClick={() => onOpen(r.recipe_id)}>
      <div className="card-image" style={{'--accent': r.accent}}><img src={r.image || APPROVED_IMAGES.placeholder} onError={e => { e.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><span className="meal-badge">{r.mealType}</span></div>
      <div className="card-body"><div className="card-meta"><span>{r.cuisine}</span><span>•</span><span className="spice">{'●'.repeat(Math.max(1,r.spice))}</span></div><h3>{r.title}</h3><p>{r.description}</p><div className="card-footer"><span><Icon name="clock" size={16}/>{r.prep + r.cook} min</span><span><Icon name="chef" size={17}/>{r.servings} servings</span></div></div>
    </article>)}</div>
    {!filtered.length && <div className="empty"><span>⌕</span><h3>No recipes found</h3><p>Try a different search or meal filter.</p></div>}
  </div>
}

function RecipeDetail({ recipe, onBack, onPlan }) {
  if (!recipe) return null
  const sections = [...new Set(recipe.ingredients.map(i => i.section_name || 'Main'))]
  return <div className="page detail-page"><button className="back" onClick={onBack}>← Back to recipes</button>
    <div className="detail-hero"><img src={recipe.image || APPROVED_IMAGES.placeholder} onError={e => { e.currentTarget.src = APPROVED_IMAGES.placeholder }} alt=""/><div className="detail-copy"><span className="pill">{recipe.mealType}</span><h1>{recipe.title}</h1><p>{recipe.description}</p><div className="tags">{[recipe.cuisine, ...recipe.dietary].map(x => <span key={x}>{x}</span>)}</div><div className="detail-stats"><div><small>PREP</small><b>{recipe.prep} min</b></div><div><small>COOK</small><b>{recipe.cook} min</b></div><div><small>SERVES</small><b>{recipe.servings}</b></div><div><small>SPICE</small><b>{['None','Mild','Medium','Warm','Hot','Fiery'][recipe.spice]}</b></div></div><button className="primary" onClick={onPlan}><Icon name="plus" size={18}/> Add to meal plan</button></div></div>
    <div className="recipe-content"><section className="paper"><h2>Ingredients</h2>{sections.map(section => <div key={section} className="ingredient-section"><h3>{section}</h3>{recipe.ingredients.filter(i => (i.section_name || 'Main') === section).map((i, idx) => <div className="ingredient-line" key={idx}><span>{i.ingredient_name}{i.optional && <em> optional</em>}</span><b>{i.quantity || ''} {i.unit}</b></div>)}</div>)}</section>
    <section className="paper"><h2>Method</h2><div className="steps">{recipe.steps.map((s,i) => <div className="step" key={i}><span>{i+1}</span><div><p>{s.instruction}</p>{s.timer > 0 && <small><Icon name="clock" size={14}/>{s.timer} minutes</small>}</div></div>)}</div></section></div>
  </div>
}

const emptyIngredient = () => ({ section_name: 'Main', ingredient_id: '', ingredient_name: '', quantity: 1, unit: 'piece', optional: false })
const emptyStep = () => ({ instruction: '', timer: 0 })
function RecipeForm({ onCancel, onSave }) {
  const [form, setForm] = useState({ title:'', source:'', description:'', cuisine:'American', mealType:'Dinner', dietary:[], categories:[], servings:4, prep:15, cook:30, spice:1, image:'', accent:'#D86B4B', ingredients:[emptyIngredient()], steps:[emptyStep()], suggestions:true, includeShopping:true, nutrition:false, substitutions:true, measurement:'us', addNow:false, planWeek:keyDate(mondayOf()), planDate:keyDate(new Date()), slot:'Dinner', time:'18:30' })
  const set = (key, value) => setForm(f => ({...f,[key]:value})); const toggleArray = (key,val) => set(key, form[key].includes(val) ? form[key].filter(x=>x!==val) : [...form[key],val])
  const updateRow = (key, i, patch) => set(key, form[key].map((x,n) => n===i ? {...x,...patch}:x))
  const move = (key,i,dir) => { const arr=[...form[key]], j=i+dir; if(j<0||j>=arr.length)return; [arr[i],arr[j]]=[arr[j],arr[i]]; set(key,arr) }
  const submit = e => { e.preventDefault(); if(!form.title.trim()) return; const recipe_id=`USER-${Date.now()}`; onSave({...form,recipe_id,image:form.image || APPROVED_IMAGES.placeholder, ingredients:form.ingredients.filter(i=>i.ingredient_name),steps:form.steps.filter(s=>s.instruction),description:form.description || 'A personal recipe from your kitchen.'}, form.addNow ? {date:form.planDate,slot:form.slot}:null) }
  return <div className="page form-page"><div className="form-title"><div><button className="back" type="button" onClick={onCancel}>← Recipe collection</button><h1>Create a new recipe</h1><p>Add the details now—you can always fine-tune them later.</p></div><div className="draft-chip">Saved locally</div></div>
    <form onSubmit={submit}><FormSection number="01" title="Recipe details" note="Start with the basics">
      <div className="field wide"><label>Recipe title *</label><input required value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Sunday lemon roast chicken"/></div>
      <div className="field wide"><label>Short description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What makes this recipe special?" rows="2"/></div>
      <div className="field"><label>Source link or name</label><input value={form.source} onChange={e=>set('source',e.target.value)} placeholder="https://… or Grandma's notebook"/></div>
      <SelectField label="Cuisine" value={form.cuisine} onChange={v=>set('cuisine',v)} options={lookups.cuisines.map(x=>x.cuisine_name)}/><SelectField label="Primary meal" value={form.mealType} onChange={v=>set('mealType',v)} options={lookups.mealTypes.map(x=>x.meal_type_name)}/>
      <ChipField label="Dietary suitability" values={lookups.dietary.map(x=>x.dietary_tag_name)} selected={form.dietary} toggle={v=>toggleArray('dietary',v)}/><ChipField label="Recipe categories" values={lookups.categories.map(x=>x.category_name)} selected={form.categories} toggle={v=>toggleArray('categories',v)}/>
    </FormSection>
    <FormSection number="02" title="Timing & yield" note="How long, and how many?">
      <div className="field"><label>Servings</label><div className="stepper"><button type="button" onClick={()=>set('servings',Math.max(1,form.servings-1))}>−</button><b>{form.servings}</b><button type="button" onClick={()=>set('servings',form.servings+1)}>+</button></div></div>
      <NumberField label="Prep time" value={form.prep} onChange={v=>set('prep',v)} suffix="min"/><NumberField label="Cook time" value={form.cook} onChange={v=>set('cook',v)} suffix="min"/>
      <div className="field total-field"><label>Total time</label><strong>{form.prep+form.cook} min</strong><small>Calculated automatically</small></div>
      <div className="field wide spice-control"><label>Spice level <b>{['No heat','Mild','Medium','Warm','Hot','Very spicy'][form.spice]}</b></label><input type="range" min="0" max="5" value={form.spice} onChange={e=>set('spice',+e.target.value)}/><div><span>No heat</span><span>Very spicy</span></div></div>
    </FormSection>
    <FormSection number="03" title="Image & appearance" note="Make it easy to spot">
      <div className="image-picker"><div className="preview"><img src={APPROVED_IMAGES.placeholder} alt="Approved recipe placeholder"/></div><div><button className="secondary" type="button" disabled>Cover image upload</button><p>New recipes use the approved kitchen placeholder in this workspace.</p></div></div>
      <div className="field wide"><label>Recipe card accent</label><div className="swatches">{['#D86B4B','#E3A641','#66916B','#478A8F','#6677A8','#A86B91'].map(c=><button type="button" aria-label={c} key={c} className={form.accent===c?'selected':''} style={{background:c}} onClick={()=>set('accent',c)}/>)}</div></div>
    </FormSection>
    <FormSection number="04" title="Ingredients" note="Group ingredients for easier cooking">
      <div className="rows wide">{form.ingredients.map((ing,i)=><div className="ingredient-row" key={i}>
        <input list="section-list" value={ing.section_name} onChange={e=>updateRow('ingredients',i,{section_name:e.target.value})} placeholder="Section"/><input className="ingredient-name" list="ingredient-list" value={ing.ingredient_name} onChange={e=>{const found=lookups.ingredients.find(x=>x.ingredient_name===e.target.value); updateRow('ingredients',i,{ingredient_name:e.target.value,ingredient_id:found?.ingredient_id||''})}} placeholder="Search ingredient…"/><input type="number" min="0" step="0.25" value={ing.quantity} onChange={e=>updateRow('ingredients',i,{quantity:+e.target.value})}/><select value={ing.unit} onChange={e=>updateRow('ingredients',i,{unit:e.target.value})}>{lookups.units.map(u=><option key={u.unit_id}>{u.unit_name}</option>)}</select>
        <label className="mini-check"><input type="checkbox" checked={ing.optional} onChange={e=>updateRow('ingredients',i,{optional:e.target.checked})}/>Optional</label><div className="row-actions"><button type="button" onClick={()=>move('ingredients',i,-1)}>↑</button><button type="button" onClick={()=>move('ingredients',i,1)}>↓</button><button type="button" onClick={()=>set('ingredients',form.ingredients.filter((_,n)=>n!==i))}><Icon name="trash" size={16}/></button></div>
      </div>)}<datalist id="ingredient-list">{lookups.ingredients.map(i=><option key={i.ingredient_id} value={i.ingredient_name}/>)}</datalist><datalist id="section-list"><option>Main</option><option>Sauce</option><option>Garnish</option><option>Vegetables</option></datalist>
      <div className="inline-actions"><button type="button" className="secondary" onClick={()=>set('ingredients',[...form.ingredients,{...emptyIngredient(),section_name:form.ingredients.at(-1)?.section_name||'Main'}])}>+ Add ingredient</button><button type="button" className="text-button" onClick={()=>set('ingredients',[...form.ingredients,{...emptyIngredient(),section_name:'New section'}])}>+ Add section</button></div></div>
    </FormSection>
    <FormSection number="05" title="Method" note="Write it in the order it happens"><div className="rows wide">{form.steps.map((s,i)=><div className="method-row" key={i}><span className="step-number">{i+1}</span><textarea rows="2" value={s.instruction} onChange={e=>updateRow('steps',i,{instruction:e.target.value})} placeholder="Describe this step…"/><label><Icon name="clock" size={16}/><input type="number" min="0" value={s.timer} onChange={e=>updateRow('steps',i,{timer:+e.target.value})}/><span>min</span></label><div className="row-actions"><button type="button" onClick={()=>move('steps',i,-1)}>↑</button><button type="button" onClick={()=>move('steps',i,1)}>↓</button><button type="button" onClick={()=>set('steps',form.steps.filter((_,n)=>n!==i))}><Icon name="trash" size={16}/></button></div></div>)}<button type="button" className="secondary add-step" onClick={()=>set('steps',[...form.steps,emptyStep()])}>+ Add step</button></div></FormSection>
    <FormSection number="06" title="Meal planning" note="Optional—put it on the calendar"><Toggle label="Show in meal-plan suggestions" checked={form.suggestions} onChange={v=>set('suggestions',v)}/><Toggle label="Add to my meal plan now" checked={form.addNow} onChange={v=>set('addNow',v)}/>{form.addNow&&<><div className="field"><label>Planning week</label><input type="date" value={form.planWeek} onChange={e=>set('planWeek',e.target.value)}/></div><div className="field"><label>Cooking date</label><input type="date" value={form.planDate} onChange={e=>set('planDate',e.target.value)}/></div><SelectField label="Meal slot" value={form.slot} onChange={v=>set('slot',v)} options={SLOTS}/><div className="field"><label>Serving time</label><input type="time" value={form.time} onChange={e=>set('time',e.target.value)}/></div></>}</FormSection>
    <FormSection number="07" title="Recipe options" note="Fine-tune how Mise uses it"><Toggle label="Include ingredients in shopping lists" checked={form.includeShopping} onChange={v=>set('includeShopping',v)}/><Toggle label="Show nutrition information" checked={form.nutrition} onChange={v=>set('nutrition',v)}/><Toggle label="Allow ingredient substitutions" checked={form.substitutions} onChange={v=>set('substitutions',v)}/><div className="field wide"><label>Measurements</label><div className="segmented"><button type="button" className={form.measurement==='us'?'active':''} onClick={()=>set('measurement','us')}>US customary</button><button type="button" className={form.measurement==='metric'?'active':''} onClick={()=>set('measurement','metric')}>Metric</button></div></div></FormSection>
    <div className="form-footer"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit">Save recipe</button></div></form>
  </div>
}
function FormSection({number,title,note,children}) { return <section className="form-section"><div className="form-section-title"><span>{number}</span><div><h2>{title}</h2><p>{note}</p></div></div><div className="form-fields">{children}</div></section> }
function SelectField({label,value,onChange,options}) { return <div className="field"><label>{label}</label><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></div> }
function NumberField({label,value,onChange,suffix}) { return <div className="field"><label>{label}</label><div className="suffix-input"><input type="number" min="0" value={value} onChange={e=>onChange(+e.target.value)}/><span>{suffix}</span></div></div> }
function ChipField({label,values,selected,toggle}) { return <div className="field wide"><label>{label}</label><div className="choice-chips">{values.map(v=><button type="button" key={v} className={selected.includes(v)?'selected':''} onClick={()=>toggle(v)}>{selected.includes(v)&&'✓ '}{v}</button>)}</div></div> }
function Toggle({label,checked,onChange}) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><i/></label> }

function Planner({ week, setWeek, plan, recipes, setSlotModal, removeSlot, onShopping }) {
  const dates = DAYS.map((day,i)=>{const d=new Date(week);d.setDate(d.getDate()+i);return {day,date:keyDate(d),num:d.getDate()}})
  const shift=n=>{const d=new Date(week);d.setDate(d.getDate()+n*7);setWeek(d)}
  const title=`${week.toLocaleDateString('en-US',{month:'long',day:'numeric'})} – ${new Date(+week+6*86400000).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`
  return <div className="page planner-page"><div className="page-heading"><div><p className="eyebrow">WEEKLY RHYTHM</p><h1>Your meal plan</h1><p>A little planning, a lot more ease.</p></div><button className="secondary" onClick={()=>setWeek(mondayOf())}>Today</button></div><div className="week-nav"><button onClick={()=>shift(-1)}>←</button><h2>{title}</h2><button onClick={()=>shift(1)}>→</button></div>
    <div className="planner-grid">{dates.map(({day,date,num},di)=><section className={`day-column ${date===keyDate(new Date())?'today':''}`} key={date}><header><small>{day.slice(0,3)}</small><b>{num}</b></header>{SLOTS.map(slot=>{const id=plan[`${date}|${slot}`],r=recipes.find(x=>x.recipe_id===id);return <div className="meal-slot" key={slot}><label>{slot}</label>{r?<div className="planned-card" style={{borderColor:r.accent}} onClick={()=>setSlotModal({date,slot,recipeId:id})}><img src={r.image||APPROVED_IMAGES.placeholder}/><div><b>{r.title}</b><small>{r.prep+r.cook} min</small></div><button onClick={e=>{e.stopPropagation();removeSlot(date,slot)}} aria-label="Remove">×</button></div>:<button className="empty-slot" onClick={()=>setSlotModal({date,slot})}><span>+</span> Add recipe</button>}</div>})}</section>)}</div>
    <div className="planner-tip"><span>✦</span><div><b>Plan once, shop once</b><p>Your shopping list updates automatically whenever this week changes.</p></div><button onClick={onShopping}>View shopping list →</button></div>
  </div>
}

function SlotModal({data,week,recipes,onClose,onAssign}) {
  const defaultDate=data.date||keyDate(week); const [date,setDate]=useState(defaultDate); const [slot,setSlot]=useState(data.slot||'Dinner'); const [query,setQuery]=useState('')
  const filtered=recipes.filter(r=>r.suggestions!==false&&(r.title+r.cuisine).toLowerCase().includes(query.toLowerCase()))
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><header><div><p className="eyebrow">MEAL PLAN</p><h2>{data.recipeId?'Replace recipe':'Choose a recipe'}</h2></div><button onClick={onClose}><Icon name="close"/></button></header><div className="modal-pickers"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><select value={slot} onChange={e=>setSlot(e.target.value)}>{SLOTS.map(x=><option key={x}>{x}</option>)}</select></div><label className="search"><Icon name="search" size={17}/><input placeholder="Search recipes…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="modal-recipes">{filtered.map(r=><button key={r.recipe_id} onClick={()=>onAssign(date,slot,r.recipe_id)}><img src={r.image||APPROVED_IMAGES.placeholder}/><span><b>{r.title}</b><small>{r.cuisine} · {r.prep+r.cook} min</small></span><i>+</i></button>)}</div></div></div>
}

function Shopping({recipes,plan,week,checked,setChecked,pantry,setPantry}) {
  const end=keyDate(new Date(+week+7*86400000)); const plannedIds=Object.entries(plan).filter(([k])=>{const d=k.split('|')[0];return d>=keyDate(week)&&d<end}).map(([,id])=>id)
  const items=useMemo(()=>{const map={};plannedIds.forEach(id=>{const r=recipes.find(x=>x.recipe_id===id);if(!r||r.includeShopping===false)return;r.ingredients.filter(i=>!i.optional).forEach(i=>{const name=i.ingredient_name,key=`${name}|${i.unit}`;const info=lookups.ingredients.find(x=>x.ingredient_name.toLowerCase()===name.toLowerCase());if(!map[key])map[key]={name,unit:i.unit,quantity:0,category:info?.shopping_category||'Grains & pantry'};map[key].quantity+=+i.quantity||0})});return Object.values(map)},[plannedIds.join(','),recipes])
  const done=items.filter(i=>checked[`${i.name}|${i.unit}`]).length
  return <div className="page shopping-page"><div className="page-heading"><div><p className="eyebrow">SMART SHOPPING</p><h1>Shopping list</h1><p>Built from {plannedIds.length} planned meal{plannedIds.length===1?'':'s'} this week.</p></div><div className="progress-ring"><b>{items.length?Math.round(done/items.length*100):0}%</b><small>done</small></div></div><div className="shopping-toolbar"><div><b>{items.length-done} items to pick up</b><span>{done} checked off</span></div><label className="pantry-toggle"><input type="checkbox" checked={pantry} onChange={e=>setPantry(e.target.checked)}/><span>Hide pantry staples</span></label></div>
    {!items.length?<div className="empty shopping-empty"><span>🧺</span><h3>Your basket is waiting</h3><p>Add recipes to this week’s meal plan and the ingredients will appear here.</p></div>:<div className="shopping-groups">{SHOP_ORDER.map(cat=>{const group=items.filter(i=>i.category===cat&&(!pantry||!['Oils & condiments','Spices'].includes(cat)));if(!group.length)return null;return <section key={cat}><header><span className={`category-icon c${SHOP_ORDER.indexOf(cat)}`}>{['⌁','◇','○','▦','◒','▤','✦'][SHOP_ORDER.indexOf(cat)]}</span><h2>{cat}</h2><small>{group.length}</small></header>{group.map(i=>{const key=`${i.name}|${i.unit}`,isDone=checked[key];return <label className={`shop-item ${isDone?'done':''}`} key={key}><input type="checkbox" checked={!!isDone} onChange={e=>setChecked(c=>({...c,[key]:e.target.checked}))}/><span className="custom-check">✓</span><b>{i.name}</b><span>{Number.isInteger(i.quantity)?i.quantity:i.quantity.toFixed(2).replace(/0+$/,'')} {i.unit}</span></label>})}</section>})}</div>}
  </div>
}
