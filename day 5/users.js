const API_URL = 'https://jsonplaceholder.typicode.com/users';

const loadButton = document.getElementById('load-users');
const filterInput = document.getElementById('filter-input');
const statusEl = document.getElementById('status');
const usersList = document.getElementById('users-list');

// All users loaded from the API. The filter works on this array,
// so typing in the box never triggers a new request.
let users = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

// Draws any array of users into the list.
function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No users match your filter.';
    usersList.appendChild(li);
    return;
  }

  list.forEach((user) => {
    const li = document.createElement('li');

    const name = document.createElement('h2');
    name.textContent = user.name;

    const email = document.createElement('p');
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement('p');
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement('p');
    company.textContent = `Company: ${user.company.name}`;

    li.append(name, email, city, company);
    usersList.appendChild(li);
  });
}

async function loadUsers() {
  loadButton.disabled = true;
  setStatus('Loading users...');

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    users = await response.json();
    applyFilter();
    setStatus(`Loaded ${users.length} users.`);
  } catch (error) {
    setStatus(`Could not load users: ${error.message}`, true);
  } finally {
    loadButton.disabled = false;
  }
}

// Filters the stored array (case-insensitive) and redraws the list.
function applyFilter() {
  const text = filterInput.value.trim().toLowerCase();
  const matches = users.filter((user) =>
    user.name.toLowerCase().includes(text)
  );
  renderUsers(matches);
}

loadButton.addEventListener('click', loadUsers);

filterInput.addEventListener('input', () => {
  if (users.length === 0) return; // nothing loaded yet
  applyFilter();
});
