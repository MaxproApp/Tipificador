  /* ================================================================
             LOGIN · Gestión de autenticación con archivo plano usuarios.json
             ================================================================ */
      const AUTH = (function () {
        // Fallback embebido: se usa si NO se puede leer usuarios.json
        // (por ejemplo si abres el index.html con doble clic y el
        //  navegador bloquea fetch() por CORS en file://)
        const USUARIOS_FALLBACK = [
          { usuario: "admin", password: "admin123", nombre: "Administrador" },
          {
            usuario: "facturacion",
            password: "fact2024",
            nombre: "Área de Facturación",
          },
          {
            usuario: "auditor",
            password: "audit2024",
            nombre: "Auditoría Interna",
          },
        ];

        const SESSION_KEY = "tipif2284_user";

        async function cargarUsuarios() {
          try {
            const res = await fetch("usuarios.json", { cache: "no-store" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();
            if (Array.isArray(data.usuarios) && data.usuarios.length) {
              return data.usuarios;
            }
            throw new Error("Formato inválido");
          } catch (e) {
            console.warn(
              "[AUTH] No se pudo leer usuarios.json → usando lista embebida.",
              e,
            );
            return USUARIOS_FALLBACK;
          }
        }

        function validar(usuario, password, lista) {
          return (
            lista.find(
              (u) =>
                u.usuario.toLowerCase() ===
                  String(usuario).trim().toLowerCase() &&
                u.password === String(password),
            ) || null
          );
        }

        function guardarSesion(user) {
          try {
            sessionStorage.setItem(
              SESSION_KEY,
              JSON.stringify({
                usuario: user.usuario,
                nombre: user.nombre,
                ts: Date.now(),
              }),
            );
          } catch (e) {
            /* noop */
          }
        }

        function obtenerSesion() {
          try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
          } catch (e) {
            return null;
          }
        }

        function cerrarSesion() {
          try {
            sessionStorage.removeItem(SESSION_KEY);
          } catch (e) {}
        }

        return {
          cargarUsuarios,
          validar,
          guardarSesion,
          obtenerSesion,
          cerrarSesion,
        };
      })();

      // Inicialización del login ANTES de montar la app
      (async function initLogin() {
        const overlay = document.getElementById("loginOverlay");
        const appCont = document.getElementById("appContainer");
        const form = document.getElementById("loginForm");
        const userInput = document.getElementById("loginUser");
        const passInput = document.getElementById("loginPass");
        const errorEl = document.getElementById("loginError");
        const loginBtn = document.getElementById("loginBtn");
        const userChip = document.getElementById("userChip");
        const logoutBtn = document.getElementById("logoutBtn");

        const usuarios = await AUTH.cargarUsuarios();

        function mostrarApp(sesion) {
          overlay.classList.add("hidden");
          appCont.style.display = "block";
          if (sesion)
            userChip.textContent = "👤 " + (sesion.nombre || sesion.usuario);
          // Dispara el evento para que el script principal sepa que ya puede inicializar (si hace falta)
          document.dispatchEvent(
            new CustomEvent("auth:ok", { detail: sesion }),
          );
        }
        function pedirConfirmacion({
          titulo,
          mensaje,
          textoOk = "Confirmar",
          icono = "⚠️",
        }) {
          return new Promise((resolve) => {
            const overlay = document.getElementById("confirmModal");
            const titleEl = document.getElementById("confirmTitle");
            const msgEl = document.getElementById("confirmMessage");
            const okBtn = document.getElementById("confirmOk");
            const cancelBtn = document.getElementById("confirmCancel");
            const iconEl = overlay.querySelector(".modal-icon");

            titleEl.textContent = titulo;
            msgEl.textContent = mensaje;
            okBtn.textContent = textoOk;
            iconEl.textContent = icono;

            // Clonar para limpiar listeners previos
            const nuevoOk = okBtn.cloneNode(true);
            const nuevoCancel = cancelBtn.cloneNode(true);
            okBtn.replaceWith(nuevoOk);
            cancelBtn.replaceWith(nuevoCancel);

            function cerrar(resultado) {
              overlay.classList.remove("show");
              setTimeout(() => resolve(resultado), 200);
            }

            nuevoOk.addEventListener("click", () => cerrar(true));
            nuevoCancel.addEventListener("click", () => cerrar(false));
            overlay.addEventListener("click", (e) => {
              if (e.target === overlay) cerrar(false);
            });

            overlay.classList.add("show");
            setTimeout(() => nuevoOk.focus(), 250);
          });
        }
        function mostrarLogin() {
          overlay.classList.remove("hidden");
          appCont.style.display = "none";
          passInput.value = "";
          errorEl.textContent = "";
          errorEl.classList.remove("show");
          document.querySelector(".login-card").classList.remove("shake");
          loginBtn.disabled = false;
          loginBtn.classList.remove("loading");
          userInput.focus();
        }

        // ¿Ya hay sesión activa?
        const sesionExistente = AUTH.obtenerSesion();
        if (sesionExistente) {
          mostrarApp(sesionExistente);
        } else {
          mostrarLogin();
        }

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const card = document.querySelector(".login-card");
          errorEl.textContent = "";
          errorEl.classList.remove("show");

          const u = userInput.value.trim();
          const p = passInput.value;

          if (!u || !p) {
            errorEl.textContent = "Completa usuario y contraseña.";
            errorEl.classList.add("show");
            card.classList.add("shake");
            setTimeout(() => card.classList.remove("shake"), 500);
            return;
          }

          loginBtn.disabled = true;
          loginBtn.classList.add("loading");

          setTimeout(() => {
            const user = AUTH.validar(u, p, usuarios);
            if (user) {
              AUTH.guardarSesion(user);
              mostrarApp({ usuario: user.usuario, nombre: user.nombre });
            } else {
              errorEl.textContent = "Usuario o contraseña incorrectos.";
              errorEl.classList.add("show");
              card.classList.add("shake");
              setTimeout(() => card.classList.remove("shake"), 500);
              passInput.value = "";
              passInput.focus();
            }
            loginBtn.disabled = false;
            loginBtn.classList.remove("loading");
          }, 400);
        });

        // ----- Helper reutilizable para pedir confirmación -----
        // ================== HELPER GLOBAL ==================

        // ----- Logout con modal elegante -----
        logoutBtn.addEventListener("click", async () => {
          const ok = await pedirConfirmacion({
            titulo: "¿Cerrar sesión?",
            mensaje: "Tu sesión se cerrará y volverás a la pantalla de inicio.",
            textoOk: "Sí, cerrar sesión",
            icono: "🚪",
          });
          if (!ok) return;

          AUTH.cerrarSesion();
          userInput.value = "";
          mostrarLogin();
        });
      })();
      /* ================================================================ */
  
      (function () {
        const TYPE_COLORS = {
          HEV: "#e74c3c",
          EPI: "#3498db",
          PDX: "#2ecc71",
          DQX: "#f39c12",
          RAN: "#9b59b6",
          CRC: "#1abc9c",
          TAP: "#e67e22",
          TNA: "#2c3e50",
          FEV: "#e84393",
          FMO: "#00b894",
          OPF: "#6c5ce7",
          LDP: "#fd79a8",
          HAU: "#00cec9",
          HAO: "#fdcb6e",
          HAM: "#a29bfe",
        };

        const TIPOS = [
          "HEV",
          "EPI",
          "PDX",
          "DQX",
          "RAN",
          "CRC",
          "TAP",
          "TNA",
          "FEV",
          "FMO",
          "OPF",
          "LDP",
          "HAU",
          "HAO",
          "HAM",
        ];
        /* Descripciones para el combo con búsqueda */
        const TIPOS_DESC = {
          HEV: "Resumen De Atención U Hoja De Evolución",
          EPI: "Epicrisis",
          PDX: "Resultado De Los Procedimientos De Apoyo Diagnóstico",
          DQX: "Descripción quirúrgica",
          RAN: "Registro de anestesia",
          CRC: "Comprobante de recibido del usuario",
          TAP: "Traslado asistencial de pacientes",
          TNA: "Transporte no asistencial ambulatorio de la persona",
          FEV: "Factura de venta",
          FMO: "Factura de venta de materiales de osteosíntesis",
          OPF: "Orden o prescripción facultativa",
          LDP: "Lista de precios",
          HAU: "Hoja de atención de urgencias",
          HAO: "Hoja de atención odontológica",
          HAM: "Hoja de administración de medicamentos",
        };
        let pages = [];
        let selectedPageId = null;
        let currentPageId = null;
        let nextId = 1;
        let zoomScale = 1.0;

        const typeButtonsDiv = document.getElementById("typeButtons");
        const viewerCanvas = document.getElementById("viewerCanvas");
        const ctx = viewerCanvas.getContext("2d");
        const noPdfMsg = document.getElementById("noPdfMsg");
        const viewerControls = document.getElementById("viewerControls");
        const viewerDocName = document.getElementById("viewerDocName");
        const currentPageNum = document.getElementById("currentPageNum");
        const totalPagesNum = document.getElementById("totalPagesNum");
        const prevPageBtn = document.getElementById("prevPageBtn");
        const nextPageBtn = document.getElementById("nextPageBtn");
        const goToPageInput = document.getElementById("goToPageInput");
        const goToPageBtn = document.getElementById("goToPageBtn");
        const zoomInBtn = document.getElementById("zoomInBtn");
        const zoomOutBtn = document.getElementById("zoomOutBtn");
        const zoomLevel = document.getElementById("zoomLevel");
        const thumbnailsContainer = document.getElementById(
          "thumbnailsContainer",
        );
        const totalDocs = document.getElementById("totalDocs");
        const assignedStats = document.getElementById("assignedStats");
        const dropzoneGallery = document.getElementById("dropzoneGallery");
        const fileInput = document.getElementById("fileInput");
        const nitInput = document.getElementById("nitInput");
        const facturaInput = document.getElementById("facturaInput");
        const generarBtn = document.getElementById("generarBtn");
        const limpiarBtn = document.getElementById("limpiarBtn");
        const bulkTypeInput = document.getElementById("bulkTypeInput");
        const bulkTypeList = document.getElementById("bulkTypeList");
        const bulkTypeClearBtn = document.getElementById("bulkTypeClear");
        const typeCombo = document.getElementById("typeCombo");
        const applyBulkTypeBtn = document.getElementById("applyBulkTypeBtn");
        const clearSelectionsBtn =
          document.getElementById("clearSelectionsBtn");
        const toastEl = document.getElementById("toast");
        let bulkTypeValue = "";
        let comboIndex = -1;
        let comboResults = [];

        const normTxt = (s) =>
          String(s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        function pintarCombo(filtro = "") {
          const f = normTxt(filtro).trim();
          comboResults = TIPOS.filter(
            (t) =>
              !f ||
              normTxt(t).includes(f) ||
              normTxt(TIPOS_DESC[t]).includes(f),
          );

          if (comboResults.length === 0) {
            bulkTypeList.innerHTML =
              '<div class="type-combo-empty">Sin resultados</div>';
            comboIndex = -1;
            return;
          }

          if (comboIndex >= comboResults.length)
            comboIndex = comboResults.length - 1;

          bulkTypeList.innerHTML = comboResults
            .map(
              (t, i) => `
      <div class="type-combo-item ${i === comboIndex ? "active" : ""}"
           data-tipo="${t}" data-index="${i}" role="option">
        <span class="combo-dot" style="background:${TYPE_COLORS[t] || "#888"}"></span>
        <span class="combo-code">${t}</span>
        <span class="combo-desc">${TIPOS_DESC[t]}</span>
      </div>`,
            )
            .join("");

          const activo = bulkTypeList.querySelector(".type-combo-item.active");
          if (activo) activo.scrollIntoView({ block: "nearest" });
        }

        function abrirCombo() {
          typeCombo.classList.add("open");
          bulkTypeInput.setAttribute("aria-expanded", "true");
        }

        function cerrarCombo() {
          typeCombo.classList.remove("open");
          bulkTypeInput.setAttribute("aria-expanded", "false");
          comboIndex = -1;
        }

        function seleccionarTipoCombo(tipo) {
          bulkTypeValue = tipo;
          bulkTypeInput.value = `${tipo} · ${TIPOS_DESC[tipo]}`;
          typeCombo.classList.add("has-value");
          bulkTypeInput.classList.remove("input-error");
          cerrarCombo();
        }

        function limpiarCombo() {
          bulkTypeValue = "";
          bulkTypeInput.value = "";
          typeCombo.classList.remove("has-value");
          bulkTypeInput.classList.remove("input-error");
          comboIndex = -1;
          cerrarCombo();
        }

        /* Acepta "HEV", "Epicrisis", "EPI · Epicrisis", etc. */
        function resolverTipo(valor) {
          const v = normTxt(valor).trim();
          if (!v) return null;
          let t = TIPOS.find((x) => normTxt(x) === v);
          if (t) return t;
          t = TIPOS.find((x) => normTxt(TIPOS_DESC[x]) === v);
          if (t) return t;
          const code = v.split("·")[0].trim();
          t = TIPOS.find((x) => normTxt(x) === code);
          return t || null;
        }

        /* ---- Eventos del combo ---- */
        bulkTypeInput.addEventListener("focus", () => {
          pintarCombo("");
          abrirCombo();
        });

        bulkTypeInput.addEventListener("input", () => {
          bulkTypeValue = "";
          typeCombo.classList.remove("has-value");
          bulkTypeInput.classList.remove("input-error");
          comboIndex = 0;
          pintarCombo(bulkTypeInput.value);
          abrirCombo();
        });

        bulkTypeInput.addEventListener("keydown", (e) => {
          const abierto = typeCombo.classList.contains("open");

          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!abierto) {
              pintarCombo(bulkTypeInput.value);
              abrirCombo();
              comboIndex = 0;
            } else {
              comboIndex = Math.min(comboResults.length - 1, comboIndex + 1);
            }
            pintarCombo(bulkTypeInput.value);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!abierto) {
              pintarCombo(bulkTypeInput.value);
              abrirCombo();
            }
            comboIndex = Math.max(0, comboIndex - 1);
            pintarCombo(bulkTypeInput.value);
          } else if (e.key === "Enter") {
            if (abierto && comboIndex >= 0 && comboResults[comboIndex]) {
              e.preventDefault();
              seleccionarTipoCombo(comboResults[comboIndex]);
            } else {
              const t = resolverTipo(bulkTypeInput.value);
              if (t) {
                e.preventDefault();
                seleccionarTipoCombo(t);
              }
            }
          } else if (e.key === "Escape") {
            cerrarCombo();
          } else if (e.key === "Tab") {
            cerrarCombo();
          }
        });

        bulkTypeList.addEventListener("mousedown", (e) => {
          const item = e.target.closest(".type-combo-item");
          if (!item) return;
          e.preventDefault();
          seleccionarTipoCombo(item.dataset.tipo);
          bulkTypeInput.focus();
        });

        bulkTypeInput.addEventListener("blur", () => {
          setTimeout(() => {
            cerrarCombo();
            if (!bulkTypeValue) {
              const t = resolverTipo(bulkTypeInput.value);
              if (t) seleccionarTipoCombo(t);
            }
          }, 130);
        });

        bulkTypeClearBtn.addEventListener("mousedown", (e) =>
          e.preventDefault(),
        );
        bulkTypeClearBtn.addEventListener("click", () => {
          limpiarCombo();
          bulkTypeInput.focus();
        });
        function showToast(msg) {
          toastEl.textContent = msg;
          toastEl.classList.add("show");
          clearTimeout(toastEl._timer);
          toastEl._timer = setTimeout(
            () => toastEl.classList.remove("show"),
            3000,
          );
        }

        function renderTypeButtons() {
          const counts = {};
          TIPOS.forEach((t) => (counts[t] = 0));
          pages.forEach((p) => {
            if (p.tipo && counts[p.tipo] !== undefined) counts[p.tipo]++;
          });
          let html = "";

          TIPOS.forEach((t) => {
            const count = counts[t] || 0;
            const color = TYPE_COLORS[t] || "#888";
            const hasItems = count > 0 ? "has-items" : "";
            html += `
        <div class="type-btn ${hasItems}" style="--type-color:${color}; border-left-color:${hasItems ? color : "transparent"};" data-tipo="${t}">
            <span class="color-indicator" style="background-color:${color};"></span>
            <span class="type-code" style="color:#1f3a57;">${t}</span>
            <span class="count" data-count="${count}">${count}</span>
        </div>
    `;
          });
          typeButtonsDiv.innerHTML = html;
        }
        function animarContadorCambiado(tipo) {
          const btn = document.querySelector(
            `.type-btn[data-tipo="${tipo}"] .count`,
          );
          if (!btn) return;
          btn.classList.remove("pop");
          // forzar reflow para reiniciar la animación
          void btn.offsetWidth;
          btn.classList.add("pop");
          setTimeout(() => btn.classList.remove("pop"), 400);
        }
        function pedirConfirmacion({
          titulo,
          mensaje,
          textoOk = "Confirmar",
          icono = "⚠️",
        }) {
          return new Promise((resolve) => {
            const overlay = document.getElementById("confirmModal");
            const titleEl = document.getElementById("confirmTitle");
            const msgEl = document.getElementById("confirmMessage");
            const okBtn = document.getElementById("confirmOk");
            const cancelBtn = document.getElementById("confirmCancel");
            const iconEl = overlay.querySelector(".modal-icon");

            titleEl.textContent = titulo;
            msgEl.textContent = mensaje;
            okBtn.textContent = textoOk;
            iconEl.textContent = icono;

            // Clonar para limpiar listeners previos
            const nuevoOk = okBtn.cloneNode(true);
            const nuevoCancel = cancelBtn.cloneNode(true);
            okBtn.replaceWith(nuevoOk);
            cancelBtn.replaceWith(nuevoCancel);

            function cerrar(resultado) {
              overlay.classList.remove("show");
              setTimeout(() => resolve(resultado), 200);
            }

            nuevoOk.addEventListener("click", () => cerrar(true));
            nuevoCancel.addEventListener("click", () => cerrar(false));
            overlay.addEventListener("click", (e) => {
              if (e.target === overlay) cerrar(false);
            });

            overlay.classList.add("show");
            setTimeout(() => nuevoOk.focus(), 250);
          });
        }
        async function renderThumbnails() {
          thumbnailsContainer.innerHTML = "";
          if (pages.length === 0) {
            thumbnailsContainer.innerHTML =
              '<div style="color:#8b9eb5; padding:0.3rem; width:100%; text-align:center; font-size:0.8rem;">No hay páginas cargadas.</div>';
            return;
          }
          for (const page of pages) {
            const thumbDiv = document.createElement("div");
            thumbDiv.className =
              "thumb-item" + (page.id === selectedPageId ? " selected" : "");
            if (page.tipo) thumbDiv.classList.add("tipo-asignado");
            thumbDiv.dataset.pageId = page.id;

            const canvas = document.createElement("canvas");
            canvas.className = "thumb-canvas";
            thumbDiv.appendChild(canvas);

            const label = document.createElement("div");
            label.className = "thumb-label";
            const shortName =
              page.name.length > 10 ? page.name.substr(0, 8) + "…" : page.name;
            label.textContent = `${shortName} (p.${page.pageNum})`;
            thumbDiv.appendChild(label);

            if (page.tipo) {
              const badge = document.createElement("span");
              badge.className = "thumb-badge";
              badge.textContent = page.tipo;
              badge.style.backgroundColor = TYPE_COLORS[page.tipo] || "#0b3b5c";
              thumbDiv.appendChild(badge);
            }

            const removeBtn = document.createElement("button");
            removeBtn.className = "thumb-remove";
            removeBtn.textContent = "✕";
            removeBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              e.preventDefault();
              const id = parseInt(thumbDiv.dataset.pageId, 10);
              await removePage(id);
            });
            thumbDiv.appendChild(removeBtn);

            const check = document.createElement("input");
            check.type = "checkbox";
            check.className = "thumb-check";
            check.dataset.pageId = page.id;
            thumbDiv.appendChild(check);

            thumbDiv.addEventListener("click", (e) => {
              if (e.target.tagName === "INPUT") return;
              const id = parseInt(thumbDiv.dataset.pageId, 10);
              selectPage(id);
            });

            thumbnailsContainer.appendChild(thumbDiv);

            try {
              if (page.pageObj) {
                const viewport = page.pageObj.getViewport({ scale: 0.2 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.pageObj.render({
                  canvasContext: canvas.getContext("2d"),
                  viewport,
                }).promise;
              }
            } catch (err) {
              console.warn("Error en miniatura para", page.name, err);
            }
          }
          updateStats();
        }

        async function selectPage(id) {
          selectedPageId = id;
          const page = pages.find((p) => p.id === id);
          if (!page) return;

          document.querySelectorAll(".thumb-item").forEach((el) => {
            el.classList.toggle(
              "selected",
              parseInt(el.dataset.pageId, 10) === id,
            );
          });

          if (page.pageObj) {
            noPdfMsg.style.display = "none";
            viewerControls.style.display = "flex";
            viewerDocName.textContent = `${page.name} (pág. ${page.pageNum} de ${page.totalPages})`;
            totalPagesNum.textContent = page.totalPages;
            currentPageId = id;
            await renderViewerPage(page);
          } else {
            noPdfMsg.style.display = "block";
            viewerControls.style.display = "none";
            viewerCanvas.style.display = "none";
          }
        }

        async function renderViewerPage(page) {
          if (!page || !page.pageObj) return;
          try {
            const viewport = page.pageObj.getViewport({ scale: zoomScale });
            viewerCanvas.width = viewport.width;
            viewerCanvas.height = viewport.height;
            viewerCanvas.style.display = "block";
            ctx.clearRect(0, 0, viewerCanvas.width, viewerCanvas.height);
            await page.pageObj.render({ canvasContext: ctx, viewport }).promise;
            currentPageNum.textContent = page.pageNum;
            goToPageInput.value = page.pageNum;
            zoomLevel.textContent = Math.round(zoomScale * 100) + "%";
          } catch (err) {
            console.warn("Error renderizando página", err);
          }
        }

        function navigatePages(delta) {
          if (!currentPageId) return;
          const currentPage = pages.find((p) => p.id === currentPageId);
          if (!currentPage) return;
          const docPages = pages
            .filter((p) => p.docId === currentPage.docId)
            .sort((a, b) => a.pageNum - b.pageNum);
          const idx = docPages.findIndex((p) => p.id === currentPageId);
          let newIdx = idx + delta;
          if (newIdx < 0) newIdx = 0;
          if (newIdx >= docPages.length) newIdx = docPages.length - 1;
          if (newIdx !== idx) selectPage(docPages[newIdx].id);
        }

        function goToPageNum() {
          if (!currentPageId) return;
          const currentPage = pages.find((p) => p.id === currentPageId);
          if (!currentPage) return;
          let val = parseInt(goToPageInput.value, 10);
          if (isNaN(val) || val < 1) val = 1;
          const docPages = pages.filter((p) => p.docId === currentPage.docId);
          if (val > docPages.length) val = docPages.length;
          const target = docPages.find((p) => p.pageNum === val);
          if (target) selectPage(target.id);
        }

        function changeZoom(delta) {
          zoomScale = Math.min(3.0, Math.max(0.3, zoomScale + delta));
          zoomLevel.textContent = Math.round(zoomScale * 100) + "%";
          if (currentPageId) {
            const page = pages.find((p) => p.id === currentPageId);
            if (page) renderViewerPage(page);
          }
        }

        // Eliminar una página específica (no todo el documento)
        // Eliminar una página específica (no todo el documento)
        async function removePage(id) {
          const pageIndex = pages.findIndex((p) => p.id === id);
          if (pageIndex === -1) return;

          const page = pages[pageIndex];
          const docId = page.docId;

          // Si es la única página del documento, confirmar con modal elegante
          const paginasDelDoc = pages.filter((p) => p.docId === docId);
          if (paginasDelDoc.length === 1) {
            const ok = await pedirConfirmacion({
              titulo: "¿Eliminar documento?",
              mensaje: `"${page.name}" solo tiene esta página. Si la eliminas, se quitará el documento completo del proceso.`,
              textoOk: "Sí, eliminar",
              icono: "🗑️",
            });
            if (!ok) return;
          }

          // Eliminar SOLO esa página
          pages.splice(pageIndex, 1);

          // Reajustar el número de página de las páginas restantes del mismo documento
          const restantes = pages
            .filter((p) => p.docId === docId)
            .sort((a, b) => a.pageNum - b.pageNum);
          restantes.forEach((p, i) => {
            p.pageNum = i + 1;
            p.totalPages = restantes.length;
          });

          // Si la página eliminada era la seleccionada o la actual, limpiar
          if (selectedPageId === id) {
            selectedPageId = null;
            currentPageId = null;
          }
          if (currentPageId === id) {
            currentPageId = null;
          }

          // Si quedan páginas, seleccionar la siguiente del mismo doc o la primera
          if (pages.length > 0) {
            const siguiente = restantes.length > 0 ? restantes[0] : pages[0];
            selectedPageId = siguiente.id;
          } else {
            noPdfMsg.style.display = "block";
            viewerControls.style.display = "none";
            viewerCanvas.style.display = "none";
          }

          renderAll();
          showToast(`🗑️ Página ${page.pageNum} eliminada.`);
        }

        function updateStats() {
          totalDocs.textContent = `${pages.length} páginas`;
          const assigned = pages.filter((p) => p.tipo).length;
          assignedStats.textContent = `${assigned} asignadas`;
        }

        function applyBulkType() {
          const tipo = bulkTypeValue || resolverTipo(bulkTypeInput.value);

          if (!tipo) {
            bulkTypeInput.classList.add("input-error");
            bulkTypeInput.focus();
            showToast("Escribe o elige un tipo válido.");
            return;
          }

          const checkboxes = document.querySelectorAll(".thumb-check:checked");
          if (checkboxes.length === 0) {
            showToast("Selecciona al menos una página.");
            return;
          }

          let count = 0;
          checkboxes.forEach((cb) => {
            const id = parseInt(cb.dataset.pageId, 10);
            const page = pages.find((p) => p.id === id);
            if (page) {
              page.tipo = tipo;
              count++;
            }
          });

          document
            .querySelectorAll(".thumb-check")
            .forEach((cb) => (cb.checked = false));

          limpiarCombo();

          // Pequeño flash verde de confirmación en el input
          bulkTypeInput.classList.remove("reset-flash");
          void bulkTypeInput.offsetWidth;
          bulkTypeInput.classList.add("reset-flash");
          setTimeout(() => bulkTypeInput.classList.remove("reset-flash"), 650);

          renderAll();
          animarContadorCambiado(tipo);
          showToast(`Tipo ${tipo} asignado a ${count} página(s).`);
        }

        function clearSelections() {
          document
            .querySelectorAll(".thumb-check")
            .forEach((cb) => (cb.checked = false));
          showToast("Selecciones limpiadas.");
        }

        function renderAll() {
          renderTypeButtons();
          renderThumbnails();
          if (selectedPageId && pages.some((p) => p.id === selectedPageId)) {
            const page = pages.find((p) => p.id === selectedPageId);
            if (page) {
              if (currentPageId !== selectedPageId) selectPage(selectedPageId);
              else renderViewerPage(page);
            }
          } else if (pages.length > 0) {
            selectPage(pages[0].id);
          } else {
            selectedPageId = null;
            currentPageId = null;
            noPdfMsg.style.display = "block";
            viewerControls.style.display = "none";
            viewerCanvas.style.display = "none";
          }
          updateStats();
        }

        async function loadFiles(files) {
          let loaded = 0;
          const fileArray = Array.from(files);
          for (const file of fileArray) {
            if (file.type !== "application/pdf") {
              showToast(`"${file.name}" no es PDF, se omite.`);
              continue;
            }
            try {
              const arrayBuffer = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer })
                .promise;
              const numPages = pdf.numPages;
              const docId = nextId++;
              for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                pages.push({
                  id: nextId++,
                  docId: docId,
                  file: file,
                  name: file.name,
                  pageNum: i, // número visible (puede cambiar al borrar)
                  realPageIndex: i - 1, // índice real en el PDF (NO cambia)
                  totalPages: numPages,
                  tipo: null,
                  arrayBuffer: arrayBuffer,
                  pdfDoc: pdf,
                  pageObj: page,
                });
              }
              loaded++;
            } catch (err) {
              showToast(`Error al cargar "${file.name}"`);
              console.error(err);
            }
          }
          if (loaded > 0) {
            renderAll();
            if (pages.length > 0) selectPage(pages[0].id);
            showToast(
              `${loaded} documento(s) cargado(s) (${pages.length} páginas).`,
            );
          } else if (fileArray.length > 0) {
            showToast("No se pudo cargar ningún PDF.");
          }
        }

        // ---- Helper para controlar el loader ----
        function zipLoaderStart() {
          const overlay = document.getElementById("zipLoader");
          const card = overlay.querySelector(".zip-loader-card");
          const title = document.getElementById("zipLoaderTitle");
          const msg = document.getElementById("zipLoaderMessage");
          const bar = document.getElementById("zipProgressBar");
          const pct = document.getElementById("zipProgressPct");
          const step = document.getElementById("zipProgressStep");

          card.classList.remove("success");
          title.textContent = "Generando ZIP…";
          msg.textContent = "Preparando documentos…";
          bar.style.width = "0%";
          pct.textContent = "0%";
          step.textContent = "Iniciando…";

          overlay.classList.add("show");
        }

        function zipLoaderUpdate(percent, message) {
          const bar = document.getElementById("zipProgressBar");
          const pct = document.getElementById("zipProgressPct");
          const step = document.getElementById("zipProgressStep");
          const msg = document.getElementById("zipLoaderMessage");

          const p = Math.max(0, Math.min(100, Math.round(percent)));
          bar.style.width = p + "%";
          pct.textContent = p + "%";
          if (message) {
            step.textContent = message;
            msg.textContent = message;
          }
        }

        function zipLoaderFinish(success, message) {
          const overlay = document.getElementById("zipLoader");
          const card = overlay.querySelector(".zip-loader-card");
          const title = document.getElementById("zipLoaderTitle");
          const msg = document.getElementById("zipLoaderMessage");
          const step = document.getElementById("zipProgressStep");

          if (success) {
            card.classList.add("success");
            document.querySelector("#zipLoader .zip-spinner-icon").textContent =
              "✅";
            title.textContent = "¡Listo!";
            msg.textContent = message || "ZIP generado correctamente";
            step.textContent = "Completado";
            zipLoaderUpdate(100, "Completado");
            setTimeout(() => {
              overlay.classList.remove("show");
              // resetear icono para la próxima vez
              setTimeout(() => {
                document.querySelector(
                  "#zipLoader .zip-spinner-icon",
                ).textContent = "📦";
              }, 300);
            }, 1400);
          } else {
            title.textContent = "Error";
            msg.textContent = message || "No se pudo generar el ZIP";
            setTimeout(() => overlay.classList.remove("show"), 1600);
          }
        }
        // NIT: solo dígitos
        nitInput.addEventListener("input", (e) => {
          const limpio = e.target.value.replace(/\D/g, "");
          if (e.target.value !== limpio) {
            e.target.value = limpio;
          }
          e.target.classList.remove("input-error");
        });
        // Factura: quitar espacios y limpiar error al escribir
        facturaInput.addEventListener("input", (e) => {
          e.target.value = e.target.value.replace(/\s+/g, " ").trimStart();
          e.target.classList.remove("input-error");
        });
        // ---- Función principal con progreso en tiempo real ----
        async function generarZip() {
          if (pages.length === 0) {
            showToast("No hay páginas para procesar.");
            return;
          }

          const nit = nitInput.value.trim();
          const factura = facturaInput.value.trim();
          // ---- VALIDACIONES ----
          nitInput.classList.remove("input-error");
          facturaInput.classList.remove("input-error");

          if (!nit) {
            nitInput.classList.add("input-error");
            nitInput.focus();
            showToast("⚠️ Ingresa el NIT antes de generar el ZIP.");
            return;
          }
          if (!/^\d+$/.test(nit)) {
            nitInput.classList.add("input-error");
            nitInput.focus();
            showToast("⚠️ El NIT solo debe contener números.");
            return;
          }
          if (!factura) {
            facturaInput.classList.add("input-error");
            facturaInput.focus();
            showToast(
              "⚠️ Ingresa el número de factura antes de generar el ZIP.",
            );
            return;
          }

          const groups = {};
          let unassigned = 0;
          pages.forEach((p) => {
            if (!p.tipo) {
              unassigned++;
              return;
            }
            if (!groups[p.tipo]) groups[p.tipo] = [];
            groups[p.tipo].push(p);
          });

          if (Object.keys(groups).length === 0) {
            showToast("Ninguna página tiene tipo asignado.");
            return;
          }

          if (unassigned > 0) {
            const ok = await pedirConfirmacion({
              titulo: "Hay páginas sin asignar",
              mensaje: `Hay ${unassigned} página(s) sin tipo asignado. ¿Deseas continuar de todas formas?`,
              textoOk: "Sí, continuar",
              icono: "⚠️",
            });
            if (!ok) return;
          }

          // 👇 Arranca la animación
          zipLoaderStart();

          try {
            const zip = new JSZip();
            // 📁 Carpeta con el número de factura dentro del ZIP
            const carpeta = zip.folder(factura);

            // Calcular total de páginas para el progreso real
            const totalPaginas = Object.values(groups).reduce(
              (sum, arr) => sum + arr.length,
              0,
            );
            let paginasProcesadas = 0;

            const tipos = Object.keys(groups);
            for (let i = 0; i < tipos.length; i++) {
              const tipo = tipos[i];
              const pagesList = groups[tipo];
              pagesList.sort(
                (a, b) => a.docId - b.docId || a.pageNum - b.pageNum,
              );

              zipLoaderUpdate(
                (paginasProcesadas / totalPaginas) * 100,
                `Procesando ${tipo}…`,
              );

              const mergedPdf = await PDFLib.PDFDocument.create();
              const docCache = {};

              for (const p of pagesList) {
                if (!docCache[p.docId]) {
                  try {
                    const src = await PDFLib.PDFDocument.load(p.arrayBuffer, {
                      ignoreEncryption: true,
                    });
                    docCache[p.docId] = src;
                  } catch (err) {
                    console.error(`No se pudo cargar ${p.name}:`, err);
                    showToast(`⚠️ No se pudo procesar "${p.name}"`);
                    continue;
                  }
                }
                const srcDoc = docCache[p.docId];
                const [copiedPage] = await mergedPdf.copyPages(srcDoc, [
                  p.realPageIndex ?? p.pageNum - 1,
                ]);
                mergedPdf.addPage(copiedPage);
              }

              const bytes = await mergedPdf.save();
              carpeta.file(`${tipo}_${nit}_${factura}.pdf`, bytes);

              // Dar un respiro al navegador para que repinte la UI
              await new Promise((r) => setTimeout(r, 30));
            }

            zipLoaderUpdate(98, "Comprimiendo archivos…");
            const zipBlob = await zip.generateAsync(
              { type: "blob" },
              (meta) => {
                // meta.percent va de 0 a 100 según JSZip
                zipLoaderUpdate(
                  98 + (meta.percent / 100) * 2,
                  `Comprimiendo… ${Math.round(meta.percent)}%`,
                );
              },
            );

            saveAs(zipBlob, `${factura}.zip`);

            zipLoaderFinish(
              true,
              `ZIP con ${tipos.length} archivo(s) generado.`,
            );
            // 🧹 Limpiar todo después de exportar
            setTimeout(() => {
              pages = [];
              selectedPageId = null;
              currentPageId = null;
              zoomScale = 1.0;
              limpiarCombo();
              document
                .querySelectorAll(".thumb-check")
                .forEach((cb) => (cb.checked = false));
              renderAll();
              showToast("🧹 Listo para un nuevo proceso.");
            }, 400);
          } catch (err) {
            console.error(err);
            zipLoaderFinish(false, "Ocurrió un error al generar el ZIP.");
          }
        }
        /* ================================================================
     PRESTADORES · Carga de prestadores.json y búsqueda por NIT
     ================================================================ */
        const PRESTADORES = (function () {
          let lista = [];
          let cargado = false;

          async function cargar() {
            try {
              const res = await fetch("prestadores.json", {
                cache: "no-store",
              });
              if (!res.ok) throw new Error("HTTP " + res.status);
              const data = await res.json();
              // El JSON es un array directo
              if (Array.isArray(data)) {
                lista = data;
              } else if (Array.isArray(data.prestadores)) {
                lista = data.prestadores;
              } else {
                throw new Error("Formato inválido");
              }
              // Normalizar NIT (quitar espacios, dejar solo dígitos)
              lista.forEach((p) => {
                p._nitLimpio = String(p.NIT || "").replace(/\D/g, "");
              });
              cargado = true;
              console.log(
                `[PRESTADORES] ${lista.length} prestadores cargados.`,
              );
              return true;
            } catch (e) {
              console.warn("[PRESTADORES] No se pudo leer prestadores.json", e);
              lista = [];
              cargado = false;
              return false;
            }
          }

          function buscarPorNit(nit) {
            if (!cargado || !nit) return null;
            const buscado = String(nit).replace(/\D/g, "");
            if (!buscado) return null;
            return lista.find((p) => p._nitLimpio === buscado) || null;
          }

          return { cargar, buscarPorNit };
        })();
        async function limpiarTodo() {
          if (pages.length === 0) return;

          const ok = await pedirConfirmacion({
            titulo: "¿Eliminar todo?",
            mensaje:
              "Se eliminarán todos los PDFs cargados y sus asignaciones.",
            textoOk: "Sí, eliminar todo",
            icono: "🗑️",
          });
          if (!ok) return;

          pages = [];
          selectedPageId = null;
          currentPageId = null;
          renderAll();
          showToast("Todo limpiado.");
        }
        function init() {
          dropzoneGallery.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzoneGallery.style.borderColor = "#0b3b5c";
          });
          dropzoneGallery.addEventListener("dragleave", () => {
            dropzoneGallery.style.borderColor = "#cbd7e6";
          });
          dropzoneGallery.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzoneGallery.style.borderColor = "#cbd7e6";
            if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
          });
          dropzoneGallery.addEventListener("click", () => fileInput.click());
          fileInput.addEventListener("change", () => {
            if (fileInput.files.length) loadFiles(fileInput.files);
            fileInput.value = "";
          });

          prevPageBtn.addEventListener("click", () => navigatePages(-1));
          nextPageBtn.addEventListener("click", () => navigatePages(1));
          goToPageBtn.addEventListener("click", goToPageNum);
          goToPageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") goToPageNum();
          });
          zoomInBtn.addEventListener("click", () => changeZoom(0.1));
          zoomOutBtn.addEventListener("click", () => changeZoom(-0.1));

          applyBulkTypeBtn.addEventListener("click", applyBulkType);
          clearSelectionsBtn.addEventListener("click", clearSelections);

          generarBtn.addEventListener("click", generarZip);
          limpiarBtn.addEventListener("click", limpiarTodo);
          facturaInput.addEventListener("input", () => {
            const pos = facturaInput.selectionStart;
            facturaInput.value = facturaInput.value.toUpperCase();
            facturaInput.setSelectionRange(pos, pos);
          });

          renderAll();
        }
        /* ====== BUSCADOR DE PRESTADOR POR NIT ====== */
        const prestadorInfo = document.getElementById("prestadorInfo");
        const inforp = document.getElementById("inforp");
        function actualizarPrestador() {
          const nit = nitInput.value.trim();
          if (!nit) {
            prestadorInfo.textContent = "";
            prestadorInfo.style.color = "#7a8fa6";
            inforp.textContent = "Separación de soportes de cobro";
            inforp.style.color = "#0b3b5c";
            return;
          }
          const p = PRESTADORES.buscarPorNit(nit);
          if (p) {
            prestadorInfo.textContent = `🏥 ${p.nombre_prestador.trim()} · Código: ${p.codigo_prestador}`;
            prestadorInfo.style.color = "#0b3b5c";
            inforp.textContent = `${p.nombre_prestador.trim()}`;
            inforp.style.color = "#0b3b5c";
          } else {
            prestadorInfo.textContent =
              "⚠️ NIT no encontrado en la lista de prestadores";
            prestadorInfo.style.color = "#c0392b";
            inforp.textContent =
              "⚠️ NIT no encontrado en la lista de prestadores";
            inforp.style.color = "#c0392b";
          }
        }

        nitInput.addEventListener("input", actualizarPrestador);
        nitInput.addEventListener("blur", actualizarPrestador);
        function updateClock() {
          const now = new Date();
          const fecha = now.toLocaleDateString("es-CO");
          const hora = now.toLocaleTimeString("es-CO");
          const el = document.getElementById("liveClock");
          if (el) el.textContent = `📅 ${fecha} · 🕐 ${hora}`;
        }
        updateClock();
        setInterval(updateClock, 1000);
        init();
        // Cargar prestadores en segundo plano
        PRESTADORES.cargar().then((ok) => {
          if (!ok) {
            console.warn("Lista de prestadores no disponible.");
          } else {
            // Si ya hay NIT escrito, actualizar de inmediato
            actualizarPrestador();
          }
        });
      })();