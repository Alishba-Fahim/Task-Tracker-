
// --- DOM Elements ---
const boardSection = document.getElementById('board-section');
const logoutBtn = document.getElementById('logout-btn');
const welcomeUser = document.getElementById('welcome-user');

// Task modal elements
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const closeModalBtn = document.getElementById('close-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const taskFormMessage = document.getElementById('task-form-message');

const todoList = document.getElementById('todo-list');
const inprogressList = document.getElementById('inprogress-list');
const doneList = document.getElementById('done-list');

// --- Search/Filter Elements ---
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');

// --- Add Reset Filter Button ---
let resetFilterBtn = document.getElementById('reset-filter-btn');
if (!resetFilterBtn) {
  resetFilterBtn = document.createElement('button');
  resetFilterBtn.id = 'reset-filter-btn';
  resetFilterBtn.textContent = 'Reset Filters';
  resetFilterBtn.className = 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition ml-2';
  if (filterStatus && filterStatus.parentNode) {
    filterStatus.parentNode.appendChild(resetFilterBtn);
  }
}

// --- State ---
let currentUser = null;
let editingTaskId = null;
let usersCache = {}; 
let allTasks = [];

// --- Auth Logic ---
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await loadUsersCache();
    showBoard();
    loadTasks();
  } else {
    // Redirect to login if not authenticated
    window.location.href = 'login.html';
  }
});

// --- Logout Logic ---
logoutBtn.addEventListener('click', async () => {
  try {
    await firebase.auth().signOut();
    window.location.href = 'login.html';
  } catch (error) {
    alert('Error logging out: ' + error.message);
  }
});

// --- UI Switching ---
function showBoard() {
  boardSection.style.display = 'block';
  updateWelcomeMessage();
  setupDragAndDrop();
}

/**
 * Updates the welcome message with user's name or email
 */
async function updateWelcomeMessage() {
  try {
    // Try to get user's name from Firestore
    const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
    if (userDoc.exists && userDoc.data().name) {
      welcomeUser.textContent = `Welcome, ${userDoc.data().name}!`;
    } else {
      welcomeUser.textContent = `Welcome, ${currentUser.email}!`;
    }
  } catch (error) {
    welcomeUser.textContent = `Welcome, ${currentUser.email}!`;
    console.error('Error getting user data:', error);
  }
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
  const snap = await firebase.firestore().collection('users').get();
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

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card bg-white rounded-lg shadow p-4 border-l-4 mb-2 ' +
    (task.status === 'todo' ? 'border-blue-500' : task.status === 'inprogress' ? 'border-yellow-500' : 'border-green-500');
  card.setAttribute('data-task-id', task.id);

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

function populateBoard(tasks) {
  clearTaskLists();
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
  const status = filterStatus ? filterStatus.value : '';
  if (status) {
    filtered = filtered.filter(task => task.status === status);
  }
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (search) {
    filtered = filtered.filter(task =>
      task.title.toLowerCase().includes(search) ||
      task.description?.toLowerCase().includes(search) ||
      (usersCache[task.assignedTo]?.name || task.assignedTo).toLowerCase().includes(search)
    );
  }
  filtered = filtered.slice().sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  populateBoard(filtered);
}

function loadTasks() {
  // Only show tasks created by or assigned to the current user
  firebase.firestore().collection('tasks')
    .onSnapshot(snapshot => {
      allTasks = [];
      snapshot.forEach(doc => {
        const task = { id: doc.id, ...doc.data() };
        // Only show tasks created by or assigned to the current user
        if (task.createdBy === currentUser.uid || task.assignedTo === currentUser.email) {
          allTasks.push(task);
        }
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
if (resetFilterBtn) {
  resetFilterBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (filterStatus) filterStatus.value = '';
    filterAndRenderTasks();
  });
}

// --- Add/Edit Task Modal Logic ---
addTaskBtn.addEventListener('click', () => openTaskModal());
closeModalBtn.addEventListener('click', closeTaskModal);

function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;
  modalTitle.textContent = task ? 'Edit Task' : 'Add Task';
  taskForm.reset();
  taskFormMessage.textContent = '';
  if (task) {
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-desc').value = task.description || '';
    document.getElementById('task-assigned').value = task.assignedTo;
    if (document.getElementById('task-due')) {
      document.getElementById('task-due').value = task.dueDate || '';
    }
  }
  taskModal.classList.remove('hidden');
}

function closeTaskModal() {
  editingTaskId = null;
  taskModal.classList.add('hidden');
  taskForm.reset();
  taskFormMessage.textContent = '';
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  taskFormMessage.textContent = '';
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
      await firebase.firestore().collection('tasks').doc(editingTaskId).update({
        title, 
        description, 
        assignedTo, 
        dueDate,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await firebase.firestore().collection('tasks').add({
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
    taskFormMessage.textContent = `Error: ${err.message}`;
  }
});

// --- Task Actions (Edit/Delete/Move) ---
function setupTaskEventDelegation() {
  const taskLists = [todoList, inprogressList, doneList];
  taskLists.forEach(list => {
    list.addEventListener('click', function(event) {
      const taskCard = event.target.closest('.task-card');
      if (!taskCard) return;
      const taskId = taskCard.getAttribute('data-task-id');
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;
      if (event.target.classList.contains('edit-btn')) {
        openTaskModal(task);
      }
      if (event.target.classList.contains('delete-btn')) {
        if (confirm('Are you sure you want to delete this task?')) {
          deleteTask(taskId);
        }
      }
      if (event.target.classList.contains('move-btn')) {
        const targetStatus = event.target.getAttribute('data-target-status');
        if (targetStatus) {
          updateTaskStatus(taskId, targetStatus);
        }
      }
    });
  });
}

async function updateTaskStatus(taskId, newStatus) {
  await firebase.firestore().collection('tasks').doc(taskId).update({ status: newStatus });
}

async function deleteTask(taskId) {
  if (confirm('Delete this task?')) {
    await firebase.firestore().collection('tasks').doc(taskId).delete();
  }
}

// --- Modal Close on Outside Click ---
window.addEventListener('click', (e) => {
  if (e.target === taskModal) closeTaskModal();
});

// --- Utility: Prevent form resubmission on reload ---
if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  setupTaskEventDelegation();
});
