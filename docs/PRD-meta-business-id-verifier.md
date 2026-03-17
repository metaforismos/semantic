# PRD: Meta Business ID Verifier
**Proyecto:** myHotel Labs → Concierge → Meta ID  
**Autor:** Andres  
**Estado:** Ready for development  
**Fecha:** 2026-03-17

---

## 1. Problema

Los hoteles que inician el onboarding de Concierge (integración Meta/WhatsApp) confunden el **Meta Business ID** con el **Facebook Page ID**. Esto bloquea el flujo de activación y genera re-trabajo operacional en el equipo de myHotel.

**Impacto actual:** Alta tasa de onboardings fallidos por ID incorrecto en el campo de configuración de Concierge.

---

## 2. Objetivo

Construir un verificador inline dentro de myHotel Labs que permita al equipo de onboarding (y opcionalmente al hotel) validar un ID antes de ingresarlo al sistema, con diagnóstico claro sobre qué tipo de ID fue ingresado.

---

## 3. Ubicación en la App

```
myHotel Labs
└── Concierge
    └── Meta ID          ← nueva subsección
        └── Verificador de Meta Business ID
```

---

## 4. Alcance (MVP)

### Dentro del alcance
- Input para pegar el ID
- Llamada al Graph API de Meta para validar
- Diagnóstico con tres estados: Business ID válido / Page ID / ID inválido
- UI clara con feedback visual por estado
- Manejo de errores de red o token expirado

### Fuera del alcance
- Guardado del ID verificado (eso ocurre en el flujo de onboarding existente)
- Historial de verificaciones
- Verificación en bulk
- Integración automática al formulario de Concierge (puede venir en V2)

---

## 5. Lógica de Verificación

### Endpoint
```
GET https://graph.facebook.com/v19.0/{ID}
    ?fields=id,name,category,verification_status
    &access_token={APP_ACCESS_TOKEN}
```

### Árbol de decisión

```
Response OK?
├── NO  → "ID inválido o no existe" ❌
└── SÍ
    ├── Tiene campo `category` (ej: "Hotel", "Local Business") 
    │   → "Esto es un Facebook Page ID, no un Business ID" ⚠️
    └── No tiene `category` / tiene `verification_status` de Business
        → "Meta Business ID válido" ✅
```

### Access Token
- Usar un **App Access Token** (no User Token): `{APP_ID}|{APP_SECRET}`
- El token se configura como variable de entorno en el backend: `META_APP_ACCESS_TOKEN`
- **El token nunca se expone en el frontend**

---

## 6. Arquitectura

### Opción recomendada: Server-side proxy
El frontend llama a un endpoint interno de myHotel que hace el fetch al Graph API, evitando exponer el token.

```
Frontend (Labs UI)
    → POST /api/labs/meta/verify-business-id
        body: { id: "123456789" }
    → Backend myHotel
        → GET graph.facebook.com/v19.0/...
    → Response al frontend:
        { valid: true, type: "business" | "page" | "invalid", name?: string }
```

### Endpoint backend (Express / Next.js API route)
```typescript
// POST /api/labs/meta/verify-business-id
async function verifyMetaBusinessId(id: string): Promise<VerificationResult> {
  const token = process.env.META_APP_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v19.0/${id}?fields=id,name,category&access_token=${token}`;
  
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    return { valid: false, type: "invalid" };
  }

  if (data.category) {
    return { valid: false, type: "page", name: data.name, category: data.category };
  }

  return { valid: true, type: "business", name: data.name };
}
```

---

## 7. UI/UX

### Layout
- Sección con título: **"Verificador de Meta Business ID"**
- Subtítulo explicativo: *"Pega el Meta Business ID del hotel antes de iniciar el onboarding. No uses el ID de la página de Facebook."*
- Input text grande, monospace, con placeholder: `Ej: 123456789012345`
- Botón: **"Verificar"**
- Área de resultado debajo del botón

### Estados del resultado

| Estado | Color | Icono | Mensaje |
|---|---|---|---|
| Business ID válido | Verde | ✅ | `Business ID válido — Nombre: {name}` |
| Es Page ID | Amarillo/Naranja | ⚠️ | `Este es un Facebook Page ID ({name}), no un Meta Business ID. Ve a business.facebook.com para obtener el correcto.` |
| ID inválido | Rojo | ❌ | `ID no encontrado. Verifica que copiaste el número correcto.` |
| Error de red/token | Gris | 🔌 | `Error al conectar con Meta. Intenta nuevamente.` |
| Loading | — | Spinner | `Verificando...` |

### Link de ayuda contextual
Incluir debajo del resultado (siempre visible):  
`¿Dónde encuentro el Meta Business ID?` → Link a guía interna o a `business.facebook.com/settings`

---

## 8. Criterios de Aceptación

- [ ] El usuario puede pegar un ID y obtener resultado en < 3 segundos
- [ ] Los tres estados de diagnóstico se muestran correctamente
- [ ] El token de Meta nunca aparece en el frontend ni en logs del navegador
- [ ] Si el ID es un Page ID, el mensaje indica explícitamente qué es y cómo encontrar el correcto
- [ ] El input acepta solo caracteres numéricos (validación client-side básica)
- [ ] Funciona en mobile (responsive)
- [ ] Si el token de entorno no está configurado, el sistema retorna un error controlado (no crash)

---

## 9. Variables de Entorno Requeridas

```env
META_APP_ACCESS_TOKEN="{APP_ID}|{APP_SECRET}"
```

Documentar en el `.env.example` del proyecto con instrucciones para obtenerlo desde Meta for Developers.

---

## 10. Consideraciones de Seguridad

- Rate limiting en el endpoint `/api/labs/meta/verify-business-id` (max 30 req/min por usuario)
- Solo usuarios autenticados en myHotel Labs pueden acceder al endpoint
- No loggear el ID verificado con datos del hotel en producción (privacidad)

---

## 11. V2 (fuera de este sprint)

- Botón "Usar este ID" que pre-llena el campo en el formulario de onboarding de Concierge
- Verificación inline directamente en el campo del formulario (con debounce)
- Historial de los últimos 5 IDs verificados por sesión
- Soporte para verificación en bulk (CSV con múltiples hoteles)

---

## 12. Dependencias

| Dependencia | Responsable | Estado |
|---|---|---|
| App Access Token de Meta configurado en entorno | Dev Ops / Andres | Pendiente |
| Acceso a la sección Labs en el repo | Dev | — |
| Diseño alineado al design system de Labs | Frontend | Seguir estilos existentes |
