import { useEffect, useMemo, useState } from 'react'
import { APPROVED_IMAGES } from './approved-images'
import recipesCsv from '../project-assets/recipes.csv?raw'
import recipeIngredientsCsv from '../project-assets/recipe_ingredients.csv?raw'
import recipeStepsCsv from '../project-assets/recipe_steps.csv?raw'
import ingredientsCsv from '../project-assets/ingredients.csv?raw'
import unitsCsv from '../project-assets/units.csv?raw'
import cuisinesCsv from '../project-assets/cuisines.csv?raw'
import mealTypesCsv from '../project-assets/meal_types.csv?raw'
import dietaryCsv from '../project-assets/dietary_tags.csv?raw'
import categoriesCsv from '../project-assets/recipe_categories.csv?raw'

const parseCsv = (text) => {
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], next = text[i + 1]
    if (c === '"' && quoted && next === '"') { cell += '"'; i += 1 }
    else if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && next === '\n') i += 1
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [headers, ...data] = rows
  return data.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])))
}

const lookups = {
  ingredients: parseCsv(ingredientsCsv), units: parseCsv(unitsCsv), cuisines: parseCsv(cuisinesCsv),
  meals: parseCsv(mealTypesCsv), diets: parseCsv(dietaryCsv), categories: parseCsv(categoriesCsv)
}
const byId = (items, idKey, valueKey, id) => items.find(x => x[idKey] === id)?.[valueKey] || id
const seedIngredients = parseCsv(recipeIngredientsCsv)
const seedSteps = parseCsv(recipeStepsCsv)
const seedRecipes = parseCsv(recipesCsv).map(r => ({
  id: r.recipe_id, title: r.title, description: r.short_description, sourceName: r.source_name, sourceUrl: r.source_url,
  servings: Number(r.servings), prep: Number(r.prep_time_minutes), cook: Number(r.cook_time_minutes), total: Number(r.total_time_minutes),
  cuisine: byId(lookups.cuisines, 'cuisine_id', 'cuisine_name', r.cuisine_id), mealType: byId(lookups.meals, 'meal_type_id', 'meal_type_name', r.meal_type_id),
  diets: r.dietary_tag_ids.split(',').filter(Boolean).map(id => byId(lookups.diets, 'dietary_tag_id', 'dietary_tag_name', id)),
  categories: r.category_ids.split(',').filter(Boolean).map(id => byId(lookups.categories, 'category_id', 'category_name', id)),
  spice: Number(r.spice_level_0_to_5), accent: r.accent_color, image: r.cover_image_url || APPROVED_IMAGES.placeholder,
  suggestions: r.include_in_meal_suggestions === 'true', includeShopping: true, nutrition: false, substitutions: true, measurement: 'US customary',
  ingredients: seedIngredients.filter(x => x.recipe_id === r.recipe_id).map(x => ({
    id: `${r.recipe_id}-${x.display_order}`, section: x.section_name, name: x.ingredient_name, quantity: x.quantity, unit: x.unit,
    notes: x.notes, optional: x.optional.toLowerCase() === 'true', category: lookups.ingredients.find(i => i.ingredient_id === x.ingredient_id)?.shopping_category || 'Grains & pantry'
  })),
  steps: seedSteps.filter(x => x.recipe_id === r.recipe_id).map(x => ({ instruction: x.instruction, timer: Number(x.timer_minutes) || '' }))
}))

const storage = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } },
  write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
}
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfWeek = (input = new Date()) => { const d = new Date(input); const day = d.getDay(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return d }
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d }
const weekInputValue = (input = new Date()) => { const d = new Date(input); d.setHours(0,0,0,0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const week1 = new Date(d.getFullYear(),0,4); const week = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7); return `${d.getFullYear()}-W${String(week).padStart(2,'0')}` }
const formatWeek = d => { const end = addDays(d, 6); return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` }
const mealSlots = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const spiceNames = ['No heat', 'Mild', 'Medium', 'Warm', 'Hot', 'Very spicy']
const blankIngredient = section => ({ id: crypto.randomUUID(), section, name: '', quantity: '', unit: 'piece', optional: false, notes: '' })
const blankRecipe = () => ({
  title: '', description: '', sourceUrl: '', cuisine: 'American', mealType: 'Dinner', diets: [], categories: [], servings: 4, prep: 15, cook: 30,
  spice: 1, accent: '#C96F4A', imageName: '', suggestions: true, planNow: false, planWeek: weekInputValue(), planDate: dateKey(new Date()), planTime: 'Dinner', specificTime: '18:30',
  includeShopping: true, nutrition: false, substitutions: true, measurement: 'US customary',
  ingredients: [blankIngredient('Main'), blankIngredient('Main')], steps: [{ instruction: '', timer: '' }, { instruction: '', timer: '' }]
})

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }
function Toggle({ on, onChange, label }) { return <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}><span />{label && <b>{label}</b>}</button> }

export default function App() {
  const [view, setView] = useState('recipes')
  const [userRecipes, setUserRecipes] = useState(() => storage.read('tablemate-recipes', []))
  const [plans, setPlans] = useState(() => storage.read('tablemate-plans', {}))
  const [checked, setChecked] = useState(() => storage.read('tablemate-checked', {}))
  const [pantry, setPantry] = useState(() => storage.read('tablemate-pantry', {}))
  const [weekStart, setWeekStart] = useState(startOfWeek)
  const [detail, setDetail] = useState(null)
  const [slotModal, setSlotModal] = useState(null)
  const [query, setQuery] = useState('')
  const [mealFilter, setMealFilter] = useState('All meals')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState(blankRecipe)
  const [optionsOpen, setOptionsOpen] = useState(true)
  const recipes = useMemo(() => [...seedRecipes, ...userRecipes], [userRecipes])
  const recipeMap = useMemo(() => Object.fromEntries(recipes.map(r => [r.id, r])), [recipes])
  useEffect(() => storage.write('tablemate-recipes', userRecipes), [userRecipes])
  useEffect(() => storage.write('tablemate-plans', plans), [plans])
  useEffect(() => storage.write('tablemate-checked', checked), [checked])
  useEffect(() => storage.write('tablemate-pantry', pantry), [pantry])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekPlans = Object.entries(plans).filter(([key]) => weekDays.some(d => key.startsWith(dateKey(d))))
  const shopping = useMemo(() => {
    const grouped = {}
    weekPlans.forEach(([, recipeId]) => {
      const recipe = recipeMap[recipeId]; if (!recipe?.includeShopping) return
      recipe.ingredients.filter(i => !i.optional).forEach(i => {
        const k = `${i.name.toLowerCase()}|${i.unit}`
        if (!grouped[k]) grouped[k] = { name: i.name, unit: i.unit, quantity: 0, textQuantities: [], category: i.category || 'Grains & pantry' }
        const n = Number(i.quantity); if (Number.isFinite(n)) grouped[k].quantity += n; else if (i.quantity) grouped[k].textQuantities.push(i.quantity)
      })
    })
    return Object.values(grouped).map(i => ({ ...i, display: i.quantity ? `${Number(i.quantity.toFixed(2))} ${i.unit}` : i.textQuantities.join(' + ') }))
  }, [weekPlans, recipeMap])

  const visibleRecipes = recipes.filter(r => {
    const hay = `${r.title} ${r.description} ${r.cuisine}`.toLowerCase()
    return hay.includes(query.toLowerCase()) && (mealFilter === 'All meals' || r.mealType === mealFilter)
  })
  const changeForm = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const toggleArray = (key, value) => changeForm(key, form[key].includes(value) ? form[key].filter(x => x !== value) : [...form[key], value])
  const updateIngredient = (id, key, value) => changeForm('ingredients', form.ingredients.map(i => i.id === id ? { ...i, [key]: value } : i))
  const moveItem = (key, index, dir) => {
    const list = [...form[key]], target = index + dir; if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]; changeForm(key, list)
  }
  const saveRecipe = e => {
    e.preventDefault(); if (!form.title.trim()) { setToast('Add a recipe title first'); return }
    const newRecipe = {
      ...form, id: `U${Date.now()}`, title: form.title.trim(), description: form.description || 'A personal recipe, ready for your table.', total: Number(form.prep) + Number(form.cook),
      image: APPROVED_IMAGES.placeholder,
      ingredients: form.ingredients.filter(i => i.name).map(i => ({ ...i, category: lookups.ingredients.find(x => x.ingredient_name.toLowerCase() === i.name.toLowerCase())?.shopping_category || 'Grains & pantry' })),
      steps: form.steps.filter(s => s.instruction.trim())
    }
    setUserRecipes(x => [...x, newRecipe])
    if (form.planNow) {
      const targetDate = form.planDate || dateKey(weekStart); const key = `${targetDate}_${form.planTime}`
      setPlans(p => ({ ...p, [key]: newRecipe.id }))
    }
    setForm(blankRecipe()); setView('recipes'); setDetail(newRecipe); setToast(`${newRecipe.title} added to your collection`)
  }
  const assignRecipe = recipeId => {
    if (!slotModal) return; setPlans(p => ({ ...p, [slotModal.key]: recipeId })); setSlotModal(null); setToast('Meal plan updated')
  }
  const removePlan = key => { setPlans(p => { const next = { ...p }; delete next[key]; return next }); setSlotModal(null); setToast('Meal removed from plan') }
  const openPlannerFor = recipe => { setDetail(null); setView('planner'); setSlotModal({ key: `${dateKey(weekStart)}_${recipe.mealType === 'Dessert' || recipe.mealType === 'Side dish' ? 'Dinner' : recipe.mealType}`, recipeId: recipe.id }) }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setView('recipes')}><span className="brandmark">T</span><span>Tablemate<small>Plan well. Eat beautifully.</small></span></button>
      <nav aria-label="Main navigation">
        <button className={view === 'recipes' ? 'active' : ''} onClick={() => setView('recipes')}>Recipes</button>
        <button className={view === 'planner' ? 'active' : ''} onClick={() => setView('planner')}>Meal planner</button>
        <button className={view === 'shopping' ? 'active' : ''} onClick={() => setView('shopping')}>Shopping list</button>
      </nav>
      <button className="primary header-add" onClick={() => setView('new')}><span>＋</span> New recipe</button>
    </header>

    {view === 'recipes' && <main className="page catalog-page">
      <section className="page-heading hero-heading"><div><p className="eyebrow">Your kitchen library</p><h1>Recipes worth returning to.</h1><p>Keep the dishes you love close, and make the week ahead feel effortless.</p></div><div className="collection-count"><strong>{recipes.length}</strong><span>recipes<br/>in your collection</span></div></section>
      <section className="toolbar">
        <label className="search"><Icon>⌕</Icon><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipes, ingredients, cuisines…" /></label>
        <div className="filter-pills">{['All meals', 'Breakfast', 'Lunch', 'Dinner', 'Snack'].map(x => <button key={x} className={mealFilter === x ? 'selected' : ''} onClick={() => setMealFilter(x)}>{x}</button>)}</div>
        <span className="results">{visibleRecipes.length} {visibleRecipes.length === 1 ? 'recipe' : 'recipes'}</span>
      </section>
      <section className="recipe-grid">
        {visibleRecipes.map(recipe => <article className="recipe-card" key={recipe.id} onClick={() => setDetail(recipe)} style={{ '--accent': recipe.accent }}>
          <div className="card-image"><img src={recipe.image || APPROVED_IMAGES.placeholder} alt="" onError={e => { e.currentTarget.src = APPROVED_IMAGES.placeholder }} /><span className="time-badge">◷ {recipe.total} min</span><button className="heart" aria-label="Save recipe" onClick={e => e.stopPropagation()}>♡</button></div>
          <div className="card-body"><div className="card-meta"><span>{recipe.cuisine}</span><span>{recipe.mealType}</span></div><h2>{recipe.title}</h2><p>{recipe.description}</p><div className="tag-row">{recipe.diets.slice(0,2).map(x => <span key={x}>{x}</span>)}</div><footer><span>Serves {recipe.servings}</span><button>View recipe <b>→</b></button></footer></div>
        </article>)}
        <button className="new-card" onClick={() => setView('new')}><span>＋</span><strong>Add your own recipe</strong><small>Bring another favorite to the table</small></button>
      </section>
    </main>}

    {view === 'planner' && <main className="page planner-page">
      <section className="page-heading"><div><p className="eyebrow">Weekly rhythm</p><h1>Your meal plan</h1><p>A calm view of what’s cooking, from Monday through Sunday.</p></div><button className="outline" onClick={() => { setWeekStart(startOfWeek()); setToast('Back to this week') }}>Today</button></section>
      <div className="week-nav"><button onClick={() => setWeekStart(addDays(weekStart,-7))}>←</button><div><small>WEEK OF</small><strong>{formatWeek(weekStart)}</strong></div><button onClick={() => setWeekStart(addDays(weekStart,7))}>→</button></div>
      <section className="planner-grid">
        {weekDays.map((day, dayIndex) => <article className={`day-column ${dateKey(day) === dateKey(new Date()) ? 'today' : ''}`} key={dateKey(day)}>
          <header><span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{day.getDate()}</b>{dateKey(day) === dateKey(new Date()) && <small>TODAY</small>}</header>
          {mealSlots.map(slot => { const key = `${dateKey(day)}_${slot}`, recipe = recipeMap[plans[key]]; return <button key={slot} className={`meal-slot ${recipe ? 'filled' : ''}`} style={{ '--accent': recipe?.accent }} onClick={() => setSlotModal({ key, recipeId: recipe?.id })}>
            <small>{slot}</small>{recipe ? <><strong>{recipe.title}</strong><span>{recipe.total} min · serves {recipe.servings}</span></> : <><i>＋</i><span>Add meal</span></>}
          </button> })}
        </article>)}
      </section>
      <div className="planner-foot"><span><i className="dot planned"/> {weekPlans.length} planned meals</span><span><i className="dot open"/> {28 - weekPlans.length} open slots</span><button onClick={() => setView('shopping')}>View shopping list →</button></div>
    </main>}

    {view === 'shopping' && <ShoppingList shopping={shopping} checked={checked} setChecked={setChecked} pantry={pantry} setPantry={setPantry} weekStart={weekStart} setView={setView} />}

    {view === 'new' && <RecipeForm form={form} changeForm={changeForm} toggleArray={toggleArray} updateIngredient={updateIngredient} moveItem={moveItem} saveRecipe={saveRecipe} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} onCancel={() => setView('recipes')} />}

    {detail && <RecipeDetail recipe={detail} onClose={() => setDetail(null)} onPlan={() => openPlannerFor(detail)} />}
    {slotModal && <SlotPicker slot={slotModal} recipes={recipes} current={recipeMap[plans[slotModal.key]]} onAssign={assignRecipe} onRemove={() => removePlan(slotModal.key)} onClose={() => setSlotModal(null)} />}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>
}

function RecipeDetail({ recipe, onClose, onPlan }) {
  const sections = [...new Set(recipe.ingredients.map(i => i.section))]
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><article className="detail-modal">
    <button className="modal-close" onClick={onClose}>×</button>
    <div className="detail-hero" style={{ '--accent': recipe.accent }}><img src={recipe.image || APPROVED_IMAGES.placeholder} alt="" onError={e => { e.currentTarget.src = APPROVED_IMAGES.placeholder }} /><div><p className="eyebrow">{recipe.cuisine} · {recipe.mealType}</p><h1>{recipe.title}</h1><p>{recipe.description}</p><div className="detail-facts"><span><b>{recipe.prep}</b> min prep</span><span><b>{recipe.cook}</b> min cook</span><span><b>{recipe.servings}</b> servings</span><span><b>{spiceNames[recipe.spice]}</b> heat</span></div><button className="primary" onClick={onPlan}>＋ Add to meal plan</button></div></div>
    <div className="detail-content"><section><p className="eyebrow">What you’ll need</p><h2>Ingredients</h2>{sections.map(section => <div key={section} className="ingredient-section"><h3>{section}</h3>{recipe.ingredients.filter(i => i.section === section).map(i => <div className="detail-ingredient" key={i.id}><span>{i.name}{i.optional && <em> optional</em>}</span><b>{i.quantity} {i.unit}</b></div>)}</div>)}</section>
    <section><p className="eyebrow">From prep to plate</p><h2>Method</h2>{recipe.steps.map((step, i) => <div className="detail-step" key={i}><b>{String(i+1).padStart(2,'0')}</b><p>{step.instruction}{step.timer && <span> ◷ {step.timer} min</span>}</p></div>)}</section></div>
  </article></div>
}

function SlotPicker({ slot, recipes, current, onAssign, onRemove, onClose }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(slot.recipeId || '')
  const [date, meal] = slot.key.split('_')
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="picker-modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Choose a recipe</p><h2>{meal} · {new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</h2><label className="search"><Icon>⌕</Icon><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your recipes" /></label>
    <div className="picker-list">{recipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase())).map(r => <button className={selected === r.id ? 'selected' : ''} key={r.id} onClick={() => setSelected(r.id)}><img src={r.image || APPROVED_IMAGES.placeholder} alt="" /><span><strong>{r.title}</strong><small>{r.cuisine} · {r.total} min</small></span><i>{selected === r.id ? '✓' : ''}</i></button>)}</div>
    <footer>{current ? <button className="danger-link" onClick={onRemove}>Remove meal</button> : <span/>}<div><button className="text-button" onClick={onClose}>Cancel</button><button className="primary" disabled={!selected} onClick={() => onAssign(selected)}>{current ? 'Replace meal' : 'Add to plan'}</button></div></footer>
  </section></div>
}

function ShoppingList({ shopping, checked, setChecked, pantry, setPantry, weekStart, setView }) {
  const categories = ['Produce','Meat & seafood','Dairy & eggs','Grains & pantry','Oils & condiments','Canned & jarred','Spices']
  const visible = shopping.filter(i => !pantry[i.name.toLowerCase()]); const done = visible.filter(i => checked[`${i.name}|${i.unit}`]).length
  return <main className="page shopping-page"><section className="page-heading"><div><p className="eyebrow">Gather what you need</p><h1>Shopping list</h1><p>Automatically gathered from meals planned for {formatWeek(weekStart)}.</p></div><div className="shopping-progress"><strong>{done}/{visible.length}</strong><span>items gathered</span><div><i style={{ width: `${visible.length ? done/visible.length*100 : 0}%` }}/></div></div></section>
    {shopping.length === 0 ? <section className="empty-state"><span>◌</span><h2>Your list is waiting</h2><p>Add recipes to this week’s meal plan and their ingredients will appear here.</p><button className="primary" onClick={() => setView('planner')}>Plan this week</button></section> : <div className="shopping-layout"><section className="shopping-list">
      {categories.map(category => { const items = visible.filter(i => i.category === category); if (!items.length) return null; return <article key={category}><header><span className={`category-icon c-${categories.indexOf(category)}`}>{['⌁','◇','○','▱','◒','▣','✣'][categories.indexOf(category)]}</span><h2>{category}</h2><small>{items.length} items</small></header>{items.map(item => { const key = `${item.name}|${item.unit}`, isDone = !!checked[key]; return <div className={`shopping-item ${isDone ? 'done' : ''}`} key={key}><button className="check" onClick={() => setChecked(c => ({...c,[key]:!c[key]}))}>{isDone ? '✓' : ''}</button><span>{item.name}</span><b>{item.display}</b><button className="pantry-action" title="I already have this" onClick={() => setPantry(p => ({...p,[item.name.toLowerCase()]:true}))}>Have it</button></div>})}</article> })}
    </section><aside className="pantry-card"><p className="eyebrow">Your pantry</p><h2>Already on hand?</h2><p>Excluded ingredients stay tucked away here. Add them back anytime.</p>{Object.keys(pantry).filter(k => pantry[k]).length ? <div>{Object.keys(pantry).filter(k => pantry[k]).map(k => <button key={k} onClick={() => setPantry(p => ({...p,[k]:false}))}>{k} <span>＋</span></button>)}</div> : <small>No excluded ingredients yet.</small>}</aside></div>}
  </main>
}

function RecipeForm({ form, changeForm, toggleArray, updateIngredient, moveItem, saveRecipe, optionsOpen, setOptionsOpen, onCancel }) {
  const sections = [...new Set(form.ingredients.map(i => i.section))]
  const addSection = () => { const name = `Section ${sections.length + 1}`; changeForm('ingredients', [...form.ingredients, blankIngredient(name)]) }
  return <main className="page form-page"><div className="form-top"><button className="back" onClick={onCancel}>← Back to recipes</button><div><p className="eyebrow">Add to your collection</p><h1>Create a new recipe</h1><p>Capture every detail now, so cooking it later feels effortless.</p></div></div>
    <form onSubmit={saveRecipe}><FormSection number="01" title="Recipe details" intro="Give your recipe a name and a little context.">
      <label className="field span-2"><span>Recipe title *</span><input value={form.title} onChange={e => changeForm('title',e.target.value)} placeholder="e.g. Sunday lemon roast chicken" /></label>
      <label className="field span-2"><span>Short description</span><textarea value={form.description} onChange={e => changeForm('description',e.target.value)} placeholder="What makes this recipe special?" /></label>
      <label className="field"><span>Source link</span><input type="url" value={form.sourceUrl} onChange={e => changeForm('sourceUrl',e.target.value)} placeholder="https://" /></label>
      <label className="field"><span>Cuisine</span><select value={form.cuisine} onChange={e => changeForm('cuisine',e.target.value)}>{lookups.cuisines.map(x => <option key={x.cuisine_id}>{x.cuisine_name}</option>)}</select></label>
      <label className="field"><span>Primary meal type</span><select value={form.mealType} onChange={e => changeForm('mealType',e.target.value)}>{lookups.meals.map(x => <option key={x.meal_type_id}>{x.meal_type_name}</option>)}</select></label>
      <div className="field span-2"><span>Dietary suitability</span><div className="choice-grid">{lookups.diets.map(x => <button type="button" className={form.diets.includes(x.dietary_tag_name)?'chosen':''} key={x.dietary_tag_id} onClick={() => toggleArray('diets',x.dietary_tag_name)}><i>{form.diets.includes(x.dietary_tag_name)?'✓':''}</i>{x.dietary_tag_name}</button>)}</div></div>
      <div className="field span-2"><span>Recipe categories</span><div className="chip-picker">{lookups.categories.map(x => <button type="button" className={form.categories.includes(x.category_name)?'chosen':''} key={x.category_id} onClick={() => toggleArray('categories',x.category_name)}>{x.category_name}{form.categories.includes(x.category_name) && ' ✓'}</button>)}</div></div>
    </FormSection>
    <FormSection number="02" title="Timing & yield" intro="Set expectations before the cooking begins.">
      <label className="field"><span>Servings</span><div className="stepper"><button type="button" onClick={() => changeForm('servings',Math.max(1,form.servings-1))}>−</button><input type="number" value={form.servings} onChange={e => changeForm('servings',Number(e.target.value))}/><button type="button" onClick={() => changeForm('servings',form.servings+1)}>＋</button></div></label>
      <label className="field"><span>Prep time <small>minutes</small></span><input type="number" min="0" value={form.prep} onChange={e => changeForm('prep',e.target.value)} /></label>
      <label className="field"><span>Cook time <small>minutes</small></span><input type="number" min="0" value={form.cook} onChange={e => changeForm('cook',e.target.value)} /></label>
      <label className="field"><span>Total time <small>calculated</small></span><input disabled value={`${Number(form.prep)+Number(form.cook)} minutes`} /></label>
      <div className="field span-2 spice-field"><span>Spice level</span><div><input type="range" min="0" max="5" value={form.spice} onChange={e => changeForm('spice',Number(e.target.value))}/><b>{spiceNames[form.spice]}</b></div><div className="range-labels"><span>Mild</span><span>Very spicy</span></div></div>
    </FormSection>
    <FormSection number="03" title="Image & appearance" intro="Choose how your recipe will look in the collection.">
      <label className="upload span-2"><input type="file" accept="image/*" onChange={e => changeForm('imageName',e.target.files?.[0]?.name || '')}/><span>↥</span><strong>{form.imageName || 'Choose a cover image'}</strong><small>{form.imageName ? 'Selected for this recipe' : 'PNG or JPG · your approved placeholder is used until saved'}</small></label>
      <div className="field span-2"><span>Card accent</span><div className="colors">{['#C96F4A','#D5A147','#718B6B','#557B81','#766B95','#9A6876'].map(c => <button type="button" key={c} style={{background:c}} className={form.accent===c?'chosen':''} onClick={() => changeForm('accent',c)} aria-label={`Select ${c}`}>{form.accent===c?'✓':''}</button>)}</div></div>
    </FormSection>
    <FormSection number="04" title="Ingredients" intro="Build sections that mirror the way you cook.">
      <datalist id="ingredient-options">{lookups.ingredients.map(i => <option key={i.ingredient_id} value={i.ingredient_name}/>)}</datalist>
      {sections.map(section => <div className="ingredient-builder span-2" key={section}><div className="builder-head"><input value={section} onChange={e => changeForm('ingredients',form.ingredients.map(i => i.section===section?{...i,section:e.target.value}:i))}/><span>SECTION</span></div>
        {form.ingredients.map((ing,index) => ing.section === section && <div className="ingredient-row" key={ing.id}><span className="drag">⠿</span><input list="ingredient-options" value={ing.name} onChange={e => updateIngredient(ing.id,'name',e.target.value)} placeholder="Search ingredient"/><input type="number" step="any" value={ing.quantity} onChange={e => updateIngredient(ing.id,'quantity',e.target.value)} placeholder="Qty"/><select value={ing.unit} onChange={e => updateIngredient(ing.id,'unit',e.target.value)}>{lookups.units.map(u=><option key={u.unit_id}>{u.unit_name}</option>)}</select><label className="optional"><input type="checkbox" checked={ing.optional} onChange={e => updateIngredient(ing.id,'optional',e.target.checked)}/>Optional</label><div className="row-actions"><button type="button" onClick={() => moveItem('ingredients',index,-1)}>↑</button><button type="button" onClick={() => moveItem('ingredients',index,1)}>↓</button><button type="button" onClick={() => changeForm('ingredients',form.ingredients.filter(i=>i.id!==ing.id))}>×</button></div></div>)}
        <button type="button" className="add-line" onClick={() => changeForm('ingredients',[...form.ingredients,blankIngredient(section)])}>＋ Add ingredient</button></div>)}
      <button type="button" className="outline span-2 add-section" onClick={addSection}>＋ Add ingredient section</button>
    </FormSection>
    <FormSection number="05" title="Method" intro="Turn the cooking process into clear, confident steps.">
      <div className="steps-builder span-2">{form.steps.map((step,index) => <div className="method-row" key={index}><b>{String(index+1).padStart(2,'0')}</b><textarea value={step.instruction} onChange={e => changeForm('steps',form.steps.map((s,i)=>i===index?{...s,instruction:e.target.value}:s))} placeholder="Describe this step…"/><label><span>◷</span><input type="number" value={step.timer} onChange={e => changeForm('steps',form.steps.map((s,i)=>i===index?{...s,timer:e.target.value}:s))} placeholder="min"/></label><div className="row-actions"><button type="button" onClick={()=>moveItem('steps',index,-1)}>↑</button><button type="button" onClick={()=>moveItem('steps',index,1)}>↓</button><button type="button" onClick={()=>changeForm('steps',form.steps.filter((_,i)=>i!==index))}>×</button></div></div>)}<button type="button" className="add-line" onClick={()=>changeForm('steps',[...form.steps,{instruction:'',timer:''}])}>＋ Add method step</button></div>
    </FormSection>
    <FormSection number="06" title="Meal planning" intro="Decide how this recipe fits into your week.">
      <div className="setting-row span-2"><div><strong>Show in meal-plan suggestions</strong><small>Let this recipe appear when choosing a meal.</small></div><Toggle on={form.suggestions} onChange={v=>changeForm('suggestions',v)}/></div>
      <div className="setting-row span-2"><div><strong>Add to my meal plan now</strong><small>Choose a date and meal slot before saving.</small></div><Toggle on={form.planNow} onChange={v=>changeForm('planNow',v)}/></div>
      {form.planNow && <div className="planning-fields span-2"><label className="field"><span>Planning week</span><input type="week" value={form.planWeek} onChange={e=>changeForm('planWeek',e.target.value)} /></label><label className="field"><span>Cooking date</span><input type="date" value={form.planDate} onChange={e=>changeForm('planDate',e.target.value)}/></label><label className="field"><span>Serving time</span><select value={form.planTime} onChange={e=>changeForm('planTime',e.target.value)}>{mealSlots.map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Specific time</span><input type="time" value={form.specificTime} onChange={e=>changeForm('specificTime',e.target.value)}/></label></div>}
    </FormSection>
    <section className="options-card"><button type="button" className="options-title" onClick={()=>setOptionsOpen(!optionsOpen)}><div><span>•••</span><strong>Recipe options</strong><small>Shopping, nutrition, substitutions & measurements</small></div><b>{optionsOpen?'⌃':'⌄'}</b></button>{optionsOpen && <div className="options-content"><div className="option-toggles"><label><Toggle on={form.includeShopping} onChange={v=>changeForm('includeShopping',v)}/><span><strong>Include ingredients in shopping lists</strong><small>Automatically add when this recipe is planned.</small></span></label><label><Toggle on={form.nutrition} onChange={v=>changeForm('nutrition',v)}/><span><strong>Show nutrition information</strong><small>Display nutrition when available.</small></span></label><label><Toggle on={form.substitutions} onChange={v=>changeForm('substitutions',v)}/><span><strong>Allow ingredient substitutions</strong><small>Show helpful swaps while cooking.</small></span></label></div><div className="measurement"><span>MEASUREMENT SYSTEM</span>{['US customary','Metric'].map(x=><button type="button" key={x} className={form.measurement===x?'chosen':''} onClick={()=>changeForm('measurement',x)}><i>{form.measurement===x?'●':'○'}</i><span><strong>{x}</strong><small>{x==='US customary'?'Cups, tablespoons, ounces':'Grams, milliliters, kilograms'}</small></span></button>)}</div></div>}</section>
    <footer className="form-actions"><button type="button" className="text-button" onClick={onCancel}>Cancel</button><button className="primary" type="submit">Save recipe <span>→</span></button></footer>
    </form>
  </main>
}

function FormSection({ number, title, intro, children }) { return <section className="form-section"><header><span>{number}</span><div><h2>{title}</h2><p>{intro}</p></div></header><div className="form-grid">{children}</div></section> }
