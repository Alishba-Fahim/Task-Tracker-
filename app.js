// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const boardSection = document.getElementById('board-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message');
const logoutBtn = document.getElementById('logout-btn');
const welcomeUser = document.getElementById('welcome-user');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const closeModalBtn = document.getElementById('close-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const saveTaskBtn = document.getElementById('save-task-btn');
const taskFormMessage = document.getElementById('task-form-message');

const todoList = document.getElementById('todo-list');
const inprogressList = document.getElementById('inprogress-list');
const doneList = document.getElementById('done-list');

// --- Search/Filter Elements ---
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');

// --- State ---
let currentUser = null;
let editingTaskId = null;
let usersCache = {}; 
let allTasks = [];

// --- Auth Logic ---
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await loadUsersCache();
    showBoard();
    loadTasks();
  } else {
    currentUser = null;
    showAuth();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    authMessage.textContent = '';
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    // Save user info in Firestore
    await db.collection('users').doc(cred.user.uid).set({
      name,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    authMessage.textContent = '';
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

// --- UI Switching ---
function showAuth() {
  authSection.style.display = 'block';
  boardSection.style.display = 'none';
  loginForm.reset();
  registerForm.reset();
  authMessage.textContent = '';
}

function showBoard() {
  authSection.style.display = 'none';
  boardSection.style.display = 'block';
  welcomeUser.textContent = `Welcome, ${currentUser.email}`;
  setupDragAndDrop();
}

// --- DRAG AND DROP  ---
function setupDragAndDrop() {
  const columns = [
    { list: todoList, status: 'todo' },
    { list: inprogressList, status: 'inprogress' },
    { list: doneList, status: 'done' }
  ];

  columns.forEach(col => {
    new Sortable(col.list, {
      group: 'tasks',
      animation: 150,
      onAdd: async function (evt) {
        const card = evt.item;
        const taskId = card.getAttribute('data-task-id');
        if (taskId) {
          await updateTaskStatus(taskId, col.status);
        }
      }
    });
  });
}

// --- Users Cache (for assignment) ---
async function loadUsersCache() {
  usersCache = {};
  const snap = await db.collection('users').get();
  snap.forEach(doc => {
    const data = doc.data();
    usersCache[data.email] = { uid: doc.id, name: data.name || data.email };
  });
}

// --- Task CRUD ---
function clearTaskLists() {
  todoList.innerHTML = '';
  inprogressList.innerHTML = '';
  doneList.innerHTML = '';
}

/**
 * Renders a single task card with Edit, Delete, and Move buttons.
 * @param {Object} task - The task object.
 * @returns {HTMLElement} - The DOM element for the task card.
 */
function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card bg-white rounded-lg shadow p-4 border-l-4 mb-2 ' +
    (task.status === 'todo' ? 'border-blue-500' : task.status === 'inprogress' ? 'border-yellow-500' : 'border-green-500');
  card.setAttribute('data-task-id', task.id);

  // Create card content with template literal
  card.innerHTML = `
    <div class="flex justify-between items-center">
      <h3 class="font-semibold text-lg text-gray-800">${task.title}</h3>
      <span class="text-xs text-gray-400">${task.dueDate ? 'Due: ' + task.dueDate : ''}</span>
    </div>
    <p class="text-gray-600 mt-1">${task.description || ''}</p>
    <div class="flex justify-between items-center mt-3">
      <span class="text-sm text-blue-600">Assigned: ${usersCache[task.assignedTo]?.name || task.assignedTo}</span>
      <div class="flex gap-2">
        <button class="edit-btn bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition" title="Edit">Edit</button>
        <button class="delete-btn bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition" title="Delete">Delete</button>
        ${getMoveBtnsHTML(task.status)}
      </div>
    </div>
  `;
  
  return card;
}

/**
 * Helper function to generate HTML for move buttons based on task status
 * @param {string} status - Current task status
 * @returns {string} - HTML for move buttons
 */
function getMoveBtnsHTML(status) {
  let btnsHTML = '';
  
  if (status === 'todo') {
    btnsHTML = `<button class="move-btn bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition" data-target-status="inprogress">In Progress</button>`;
  } else if (status === 'inprogress') {
    btnsHTML = `
      <button class="move-btn bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition" data-target-status="done">Done</button>
      <button class="move-btn bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition" data-target-status="todo">To Do</button>
    `;
  } else if (status === 'done') {
    btnsHTML = `<button class="move-btn bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition" data-target-status="inprogress">In Progress</button>`;
  }
  
  return btnsHTML;
}

/**
 * Populates the board columns with tasks.
 * @param {Array} tasks - Array of task objects.
 */
function populateBoard(tasks) {
  // Clear existing tasks
  clearTaskLists();
  
  // Render tasks in their respective columns
  tasks.forEach(task => {
    const card = renderTaskCard(task);
    if (task.status === 'todo') {
      todoList.appendChild(card);
    } else if (task.status === 'inprogress') {
      inprogressList.appendChild(card);
    } else if (task.status === 'done') {
      doneList.appendChild(card);
    }
  });
}

// --- Filtering Logic ---
function filterAndRenderTasks() {
  let filtered = allTasks;

  // Filter by status
  const status = filterStatus ? filterStatus.value : '';
  if (status) {
    filtered = filtered.filter(task => task.status === status);
  }

  // Filter by search
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (search) {
    filtered = filtered.filter(task =>
      task.title.toLowerCase().includes(search) ||
      task.description?.toLowerCase().includes(search) ||
      (usersCache[task.assignedTo]?.name || task.assignedTo).toLowerCase().includes(search)
    );
  }

  // Sort by due date (soonest first, empty due dates last)
  filtered = filtered.slice().sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  // Use the new populateBoard function to render tasks
  populateBoard(filtered);
}

function loadTasks() {
  // Listen for real-time updates
  db.collection('tasks').orderBy('createdAt')
    .onSnapshot(snapshot => {
      allTasks = [];
      snapshot.forEach(doc => {
        const task = { id: doc.id, ...doc.data() };
        allTasks.push(task);
      });
      filterAndRenderTasks();
    });
}

// --- Filter/Search Event Listeners ---
if (searchInput) {
  searchInput.addEventListener('input', filterAndRenderTasks);
}

if (filterStatus) {
  filterStatus.addEventListener('change', filterAndRenderTasks);
}

async function addOrUpdateTask(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const assignedTo = document.getElementById('task-assigned').value.trim().toLowerCase();
  const dueDateInput = document.getElementById('task-due');
  const dueDate = dueDateInput ? dueDateInput.value : '';

  if (!title || !description || !assignedTo) {
    taskFormMessage.textContent = 'Title, description and assignee are required.';
    return;
  }
  if (!usersCache[assignedTo]) {
    taskFormMessage.textContent = 'Assigned user not found.';
    return;
  }

  try {
    if (editingTaskId) {
      // Update
      await db.collection('tasks').doc(editingTaskId).update({
        title, description, assignedTo, dueDate
      });
    } else {
      // Add new
      await db.collection('tasks').add({
        title,
        description,
        assignedTo,
        dueDate,
        status: 'todo',
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    closeTaskModal();
  } catch (err) {
    taskFormMessage.textContent = err.message;
  }
}

async function updateTaskStatus(taskId, newStatus) {
  await db.collection('tasks').doc(taskId).update({ status: newStatus });
}

async function deleteTask(taskId) {
  if (confirm('Delete this task?')) {
    await db.collection('tasks').doc(taskId).delete();
  }
}

// --- Modal Logic ---
addTaskBtn.addEventListener('click', () => openTaskModal());
closeModalBtn.addEventListener('click', closeTaskModal);

function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;
  modalTitle.textContent = task ? 'Edit Task' : 'Add Task';
  taskForm.reset();
  taskFormMessage.textContent = '';
  if (task) {
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-desc').value = task.description;
    document.getElementById('task-assigned').value = task.assignedTo;
    if (document.getElementById('task-due')) {
      document.getElementById('task-due').value = task.dueDate || '';
    }
  }
  taskModal.style.display = 'flex';
}

function closeTaskModal() {
  editingTaskId = null;
  taskModal.style.display = 'none';
  taskForm.reset();
  taskFormMessage.textContent = '';
}

taskForm.addEventListener('submit', addOrUpdateTask);

// Close modal on outside click
window.addEventListener('click', (e) => {
  if (e.target === taskModal) closeTaskModal();
});

// --- Utility: Prevent form resubmission on reload ---
if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}

// Initialize drag and drop when the page loads
document.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    setupDragAndDrop();
  }
  
  // Set up event delegation for task actions
  setupTaskEventDelegation();
});

/**
 * Sets up event delegation for task actions (Edit, Delete, Move)
 */
function setupTaskEventDelegation() {
  const taskLists = [todoList, inprogressList, doneList];
  
  taskLists.forEach(list => {
    list.addEventListener('click', function(event) {
      const taskCard = event.target.closest('.task-card');
      if (!taskCard) return;
      
      const taskId = taskCard.getAttribute('data-task-id');
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Edit button
      if (event.target.classList.contains('edit-btn')) {
        openTaskModal(task);
      }
      
      // Delete button
      if (event.target.classList.contains('delete-btn')) {
        if (confirm('Are you sure you want to delete this task?')) {
          deleteTask(taskId);
        }
      }
      
      // Move button
      if (event.target.classList.contains('move-btn')) {
        const targetStatus = event.target.getAttribute('data-target-status');
        if (targetStatus) {
          updateTaskStatus(taskId, targetStatus);
        }
      }
    });
  });
}
