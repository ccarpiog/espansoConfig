1. FORBIDDEN CLAIMS

- **Blocking — `code.findingCode.matchHasSeveralTriggerForms`**  
  Problem: “where espanso expects exactly one” predicts espanso’s behaviour/model, violating claim 1.  
  Fix: “This snippet uses more than one of trigger, triggers and regex. espansoConfig treats this as suspicious because its model allows exactly one.”

- **Blocking — `code.findingCode.duplicateVariableName`**  
  Problem: “espanso keeps the last one” definitively predicts espanso’s behaviour, violating claim 1’s broader prohibition on such predictions.  
  Fix: “Two variables in this block are called “{name}”. espansoConfig cannot safely determine which definition would be used.”

- **Should-fix (borderline) — `code.verificationFailure.doesNotParse`**  
  Problem: “The result is no longer valid YAML” converts one parser’s failure into an absolute validity judgment. Although it asserts invalidity rather than validity, it has the same unsupported reading as claim 3.  
  Fix: “espansoConfig’s YAML parser could not parse the result.”

No English string promises absolute durability or unlimited/versioned recovery. The “left as it was,” “before replacing it,” and “never put in place” statements are scoped to the target or destination and therefore do not claim that nothing whatsoever was written.

2. SPANISH QUALITY

- **Blocking — `code.findingCode.matchHasSeveralTriggerForms`**  
  Problem: “cuando espanso espera exactamente uno” repeats the forbidden prediction.  
  Fix: “Este fragmento usa más de uno de los campos trigger, triggers y regex. espansoConfig lo considera sospechoso porque su modelo solo admite uno.”

- **Blocking — `code.findingCode.duplicateVariableName`**  
  Problem: “espanso se queda con la última” repeats the unsupported behaviour claim.  
  Fix: “Dos variables de este bloque se llaman «{name}». espansoConfig no puede determinar con seguridad qué definición se usaría.”

- **Should-fix — `code.verificationFailure.doesNotParse`**  
  Problem: “ya no es YAML válido” is the same absolute validity claim.  
  Fix: “El analizador de YAML de espansoConfig no pudo analizar el resultado.”

- **Should-fix — `code.writeStep.inspectTarget`**  
  Problem: “leer qué es” is an English-shaped calque.  
  Fix: “abrir el archivo y comprobar de qué tipo es”

- **Should-fix — `code.writeStep.copyMetadata`**  
  Problem: “lista de acceso” mistranslates *access list*.  
  Fix: “copiar la lista de control de acceso y los atributos extendidos del archivo”

- **Should-fix — `code.backupError.backupRootNotPrivate`**  
  Problem: “A {path} puede llegar alguien” sounds machine-translated.  
  Fix: “Otras personas además de su propietario pueden acceder a {path}, así que espansoConfig no guardará allí copias de tu configuración.”

- **Minor — `code.backupError.destinationExists`**  
  Problem: “no tenía derecho a elegir” anthropomorphizes the copy.  
  Fix: “Algo ocupa ya {path}, y no se podía elegir otro nombre para esta copia.”

- **Should-fix — `code.editError.sourceDoesNotParse`**  
  Problem: “no se analiza” and “direccionarse” are unnatural technical calques.  
  Fix: “El analizador no puede interpretar el archivo como YAML, así que no puede localizarse ningún elemento dentro de él.”

- **Should-fix — `code.editError.verification`**  
  Problem: “no se sostuvo” is unnatural and unclear.  
  Fix: “El resultado no superó la nueva lectura y comprobación, por lo que se descartó.”

- **Should-fix — `code.verificationFailure.movedBytesWereRewritten`**  
  Problem: “aterrizaron” / “se levantaron” is overly literal.  
  Fix: “Los bytes colocados en el destino no coinciden con los extraídos del origen.”

- **Should-fix — `code.decodeError.spanOutsideSource`**  
  Problem: “no recorta el archivo” is an incorrect calque of *slice*.  
  Fix: “El rango de bytes del valor no delimita una parte válida del archivo o cae dentro de un carácter.”

3. ENGLISH REGISTER AND ACCURACY

- **Should-fix — `code.saveError.targetNotUtf8`**  
  Problem: “there is no text to change” is overly absolute; bytes still exist.  
  Fix: “{path} is not valid UTF-8 at byte {offset}, so espansoConfig cannot edit it as text.”

- **Should-fix — `code.editError.malformedSpan`**  
  Problem: “did not slice the file” leaks implementation jargon.  
  Fix: “A byte range did not identify a valid part of the file. That is a fault in this app.”

- **Should-fix — `code.editError.lastEntryOfMapping`**  
  Problem: “rather than what it contains” contradicts removal changing the contents.  
  Fix: “Removing this would turn the block into an empty value and change its meaning.”

- **Should-fix — `code.editError.verification`**  
  Problem: “it did not hold” is opaque.  
  Fix: “The result was parsed and checked again, did not pass those checks, and was discarded.”

- **Minor — `code.saveVerdict.proceed`**  
  Problem: the two instances of “it” have unclear antecedents.  
  Fix: “Nothing found in the result prevents espansoConfig from saving it.”

**Forbidden-claim count: 3 English strings.**

Codex session ID: 019fbf3c-5c12-7af1-a1fe-aedc96b940a3
Resume in Codex: codex resume 019fbf3c-5c12-7af1-a1fe-aedc96b940a3
