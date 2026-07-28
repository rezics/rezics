Trata el token como una contraseña. Una entrega segura mantiene el secreto fuera de la conversación con la IA.

1. El agente solicita un espacio de trabajo dedicado y explica qué archivos y comandos utilizará.
2. El agente puede crear un archivo `.env` vacío y añadirlo a `.gitignore`, pero se detiene antes de que se introduzca cualquier credencial.
3. El usuario introduce `REZICS_API_TOKEN` localmente. No pegues el token en un chat con IA: entregarlo directamente a una IA crea un riesgo de divulgación inevitable.
4. El código lee el token únicamente desde el entorno del proceso. Nunca debe imprimirlo, incluirlo en una URL, escribirlo en registros ni incorporarlo a un commit.
5. Empieza con el conjunto de permisos más pequeño y la política Standard. El endpoint seguro de autoinspección del token puede informar de la identidad, los permisos y los límites efectivos sin devolver el token ni ningún otro secreto.
6. La automatización utiliza lotes acotados, puntos de control y espera exponencial. El usuario desactiva o revoca el token al finalizar la tarea.
