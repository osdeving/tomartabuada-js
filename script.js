const questionEl = document.getElementById("question");
const answerInput = document.getElementById("answer");
const submitBtn = document.getElementById("submitBtn");
const errorMessage = document.getElementById("errorMessage");
const indicator = document.getElementById("indicator");
const tabuadaContainer = document.getElementById("tabuadaContainer");

let selectedCells = {}; // Armazena quais células estão ativas
let currentQuestion = { x: 0, y: 0 };
let startTime;

// Inicializa a matriz de células
function initializeSelectedCells() {
  for (let i = 1; i <= 9; i++) {
      
      selectedCells[i] = {};
      
      for (let j = 1; j <= 9; j++) {
          if (i < 3 || i == 5 || j < 3 || j == 5) {
              selectedCells[i][j] = false;
          } else {
              selectedCells[i][j] = true;
          }
    }
  }
}

// Gera a matriz de tabuadas
function generateTabuadaMatrix() {
  tabuadaContainer.innerHTML = "";

  // Adiciona as linhas da matriz
  for (let i = 1; i <= 9; i++) {
    // Adiciona o número da linha na primeira coluna
    const rowNumber = document.createElement("div");
    rowNumber.textContent = i;
    rowNumber.classList.add("number");
    rowNumber.addEventListener("click", () => toggleRow(i));
    tabuadaContainer.appendChild(rowNumber);

    for (let j = 1; j <= 9; j++) {
        const cell = document.createElement("div");
        cell.classList.add("cell" + i + j);
      cell.classList.add("cell");
      if (selectedCells[i][j]) {
        cell.classList.add("active");
      }
      cell.setAttribute("data-bs-toggle", "tooltip");
      cell.setAttribute("title", `${i} × ${j} = ${i * j}`);
      cell.addEventListener("click", () => toggleCell(i, j, cell));
      tabuadaContainer.appendChild(cell);
    }
  }

  // Ativa tooltips do Bootstrap
  const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltips.forEach((tooltip) => new bootstrap.Tooltip(tooltip));
}

// Marca ou desmarca uma linha inteira
function toggleRow(row) {
  const isActive = Object.values(selectedCells[row]).every((cell) => cell);
  for (let j = 1; j <= 9; j++) {
    selectedCells[row][j] = !isActive;
  }
  generateTabuadaMatrix();
}

// Marca ou desmarca uma coluna inteira
function toggleColumn(col) {
  const isActive = Object.values(selectedCells).every((row) => row[col]);
  for (let i = 1; i <= 9; i++) {
    selectedCells[i][col] = !isActive;
  }
  generateTabuadaMatrix();
}

// Marca ou desmarca uma célula específica
function toggleCell(row, col, cell) {
  selectedCells[row][col] = !selectedCells[row][col];
  cell.classList.toggle("active");
}

// Gera uma nova pergunta
function generateQuestion() {
  const activeCells = [];
  for (let i = 1; i <= 9; i++) {
    for (let j = 1; j <= 9; j++) {
      if (selectedCells[i][j]) {
        activeCells.push({ x: i, y: j });
      }
    }
  }

  if (activeCells.length === 0) {
    errorMessage.textContent = "Por favor, selecione ao menos uma célula.";
    return;
  }

  errorMessage.textContent = "";
  const { x, y } = activeCells[Math.floor(Math.random() * activeCells.length)];
  currentQuestion = { x, y };
  questionEl.textContent = `${x} × ${y}`;
  answerInput.value = "";
  answerInput.focus();
  startTime = new Date();
}

// Verifica a resposta
function checkAnswer() {
  const userAnswer = parseInt(answerInput.value, 10);
  const correctAnswer = currentQuestion.x * currentQuestion.y;

  if (userAnswer === correctAnswer) {
    const timeTaken = new Date() - startTime;
    gamification(timeTaken);
    generateQuestion();
  } else {
    errorMessage.textContent = "Resposta incorreta. Tente novamente!";
  }
}

// Ajusta os indicadores de desempenho
function gamification(timeTaken) {
    if (timeTaken < 1000) {
      indicator.textContent = "Quem é você? Euler?";
      indicator.className = "indicator green";
    } else if (timeTaken < 2000) {
      indicator.textContent = "Excelente! Muito Rápido!!!";
      indicator.className = "indicator green";
    } else if (timeTaken < 3000) {
      indicator.textContent = "Tá se achando! Rápido, mas não o bastante!";
      indicator.className = "indicator green";
    } else if (timeTaken < 6000) {
      indicator.textContent = "Bom, mas pode ser mais rápido!";
      indicator.className = "indicator orange";
    } else {
      indicator.textContent = "Muito devagar! Tente ser mais rápido!";
      indicator.className = "indicator red";
    }
}

// Eventos
submitBtn.addEventListener("click", checkAnswer);
answerInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    checkAnswer();
  }
});

// Inicialização
initializeSelectedCells();
generateTabuadaMatrix();
generateQuestion();
