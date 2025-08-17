const STORAGE_KEY = "todo.tasks.v1";

const todoList = document.getElementById("todoList");
const todoInput = document.getElementById("todoInput");
const todoForm = document.getElementById("todoForm");

/* ---------- Storage helpers ---------- */
function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/* ---------- Render ---------- */
function render(tasks) {
  // Clear current list
  todoList.innerHTML = "";

  // Rebuild list items
  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    if (task.done) li.classList.add("done");

    const span = document.createElement("span");
    span.textContent = task.text;

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.className = "delete";
    delBtn.setAttribute("aria-label", `Delete ${task.text}`);

    // Toggle done
    span.addEventListener("click", () => {
      const tasksNow = loadTasks();
      tasksNow[index].done = !tasksNow[index].done;
      saveTasks(tasksNow);
      render(tasksNow);
    });

    // Delete
    delBtn.addEventListener("click", () => {
      const tasksNow = loadTasks();
      tasksNow.splice(index, 1);
      saveTasks(tasksNow);
      render(tasksNow);
    });

    li.appendChild(span);
    li.appendChild(delBtn);
    todoList.appendChild(li);
  });
}

/* ---------- Add task ---------- */
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const tasks = loadTasks();
  tasks.push({ text: trimmed, done: false });
  saveTasks(tasks);
  render(tasks);
}

/* ---------- Events ---------- */
todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask(todoInput.value);
  todoInput.value = "";
  todoInput.focus();
});

/* ---------- Init ---------- */
render(loadTasks());
