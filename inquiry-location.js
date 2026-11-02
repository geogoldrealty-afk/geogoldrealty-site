// Explicit visitor choice; never guess location from a name or message.
export function addInquiryLocation(form) {
  if (!form || form.elements.state) return;
  const label = document.createElement('label');
  label.textContent = 'Where are you looking for real estate help?';
  const select = document.createElement('select');
  select.name = 'state'; select.required = true;
  for (const [value, text] of [['','Choose a location'],['NJ','New Jersey'],['OTHER','Another state / not sure']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text;
    select.append(option);
  }
  label.append(select);
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.before(label); else form.append(label);
}
