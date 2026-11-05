# PokéSurvivor · Mundo Misterioso

Bullet-heaven con Pokémon al estilo de Survivor.io y Megabonk, con sprites de
*Pokémon Mundo Misterioso*, capa roguelike, **966 Pokémon de las 9 generaciones**,
shinies y gacha por región. Música y efectos compuestos para el juego.

HTML + CSS + JavaScript sobre Canvas 2D, en el navegador y en el móvil.

> **Autoría / Authorship**
>
> PokéSurvivor (su código y su música original) lo ha escrito y es de
> **Jonathan Piera Torregrosa**, dueño de esta cuenta (JPTER78) y de pokesurvivor.com.
> The source code and original music of PokéSurvivor are written and owned by
> **Jonathan Piera Torregrosa**, owner of this GitHub account (JPTER78) and of
> pokesurvivor.com. Google copyright removal request **4-2352000042234**
> (against pokesurvivor.co) was submitted by me.

> **Aviso sobre criptomonedas / Crypto disclaimer**
>
> PokéSurvivor **no tiene ninguna criptomoneda, token ni NFT oficial**, y yo no
> he creado ninguno. Cualquier token que use el nombre del juego lo han creado
> terceros. **No me hago cargo de ninguna compra, venta o inversión** que hagas
> con ellos y nada de lo que hay aquí es una recomendación de inversión. El
> juego es gratis y lo seguirá siendo.
>
> PokéSurvivor has **no official cryptocurrency, token or NFT**, and I have not
> created any. Any token using the game's name was created by third parties.
> **I take no responsibility for any purchase, sale or investment** you make
> with them, and nothing here is investment advice. The game is free and will
> stay free.

## Jugar

Entra en [pokesurvivor.com](https://pokesurvivor.com). Crea una cuenta o entra como invitado, haz el test
de personalidad y a la mazmorra.

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` / flechas | Moverse |
| `5` `6` `7` `8` | Usar esferas |
| `Esc` / `P` | Pausa |

**En móvil o tablet** (en horizontal): pon el dedo en cualquier sitio y arrastra
para moverte (el joystick aparece donde tocas), toca una esfera para usarla
y el botón de arriba a la derecha para pausar. Se puede instalar como
app ("Añadir a pantalla de inicio"). En **Ajustes** hay sonido, calidad gráfica
(con modo automático), números de daño, menos sacudidas, FPS y la cuenta.

El Pokémon usa **todos sus movimientos equipados automáticamente desde el
inicio**, combinados en un solo grupo de hasta cuatro movimientos. No hace falta
cambiar de ataque ni vencer a un legendario para vincularlos. Cada movimiento
conserva su tiempo de recarga y sus requisitos de alcance y objetivo; los
movimientos de apoyo también están activos. Las rocas, cofres y la hierba
alta se rompen; las paredes y los árboles bloquean los disparos enemigos; el
agua frena y la lava quema (también a los enemigos).

En el mapa hay **altares de poder**, **manantiales** que curan, **cofres con
candado** (quédate a su lado unos segundos) y **trampas** que también dañan a
los enemigos. A veces se abre una **grieta**: entra y lucharás contra un
**legendario** en una arena aparte.

Hay **tabla de tipos** (un Rayo Burbuja le quita más a un Charmander) y,
de vez en cuando, **climas** (sol, lluvia, arena, nieve, niebla) que potencian
unos tipos y debilitan otros.

Cada día hay **misiones** (y semanales) que dan tickets y monedas; los
**logros** dan medallas y títulos, y tu **perfil** enseña tus 3 Pokémon
favoritos, tus marcas y tus medallas. En las runs encuentras **objetos** (Restos,
Cinta Elección...) y mejoras temporales de estadísticas. Los
enemigos tienen personalidad: curan, ponen escudos, llaman a su manada o atacan
con aviso en el suelo.

Las **mejoras** son de cada Pokémon. El **gacha** va con **tickets** que se
ganan jugando (×1 de algunos Pokémon, ×10 de jefes y legendarios), y se tira
en una tragaperras pixel art.

Cada enemigo tiene 1/4096 de salir **shiny**: brilla, una flecha en el borde de
la pantalla te dice dónde está, y si lo derrotas te lo quedas. En el gacha sale
shiny 1 de cada 100 tiradas. En la colección eliges tu compañero en versión
normal o shiny.

La música suena tras el primer clic (los navegadores no dejan reproducir sonido
antes). Volumen y silencio: botón del altavoz arriba a la derecha, o en la pausa.

El guardado local de las cuentas vive en el `localStorage` del navegador: si
borras los datos del sitio y no tienes copia en la nube, se pierde. Los invitados
no guardan progreso al cerrar o recargar.

## Pueblo principal

Al entrar, después de elegir compañero, llegas a **Villa Compañera**: un pueblo
sin combate que recorres con tu Pokémon seleccionado, en su versión normal o
shiny. El pueblo tiene siete edificios con tejados y fachadas diferentes:
un gimnasio rotulado **Entrenamiento**, un centro rotulado **Pokémon** para la colección,
**Ajustes**, la **Tienda** de Kecleon, **Mochila**, **Gacha** y **Misiones**.
El Centro Pokémon ocupa la antigua parcela de Amigos al oeste de la plaza;
Misiones está en la parcela del noreste. **Amigos** se abre desde la cabina de
teléfono situada en el césped a la derecha del tablón del Ranking.
Los caminos conectan una plaza adoquinada, un estanque, bancos y jardines,
rodeados de árboles; las farolas están alineadas fuera de los caminos.

El **Ranking** se consulta en un tablón junto a la plaza. Para preparar una
**Expedición**, sigue el camino que sale del pueblo hacia el norte y usa el botón
de interacción: caminar hasta la salida no abre la preparación ni empieza una
partida automáticamente. Se conserva la preparación de movimientos existente.
No hay una casa separada de **Mejoras**; sus opciones están integradas en
**Entrenamiento** junto con los movimientos. Los edificios, el tablón y la cabina
abren las pantallas existentes, sin interiores.

Muévete con **WASD o las flechas** y pulsa **E o Espacio** cerca de una puerta,
el tablón, la cabina o la salida norte para interactuar. El panel de interacción
solo aparece al situarte directamente delante del destino; no se activa desde
un lateral ni por detrás. En móvil horizontal hay una cruceta y el mismo botón
contextual.
**M, Esc o Menú** abren el menú de siempre sin tener que caminar; **Volver al
pueblo** lo cierra. Al cerrar una pantalla abierta desde una puerta, vuelves al
mismo sitio; si la abriste desde el menú, vuelves a la lista.

El pueblo no cambia tus monedas, colección, entrenamiento ni guardado. No da
XP por caminar y la posición sólo dura durante la sesión de esa cuenta.
Los amigos y las partidas cooperativas funcionan como antes; el pueblo no
es una sala multijugador. Al terminar una partida individual, primero se
mantienen los resultados, la XP permanente y las evoluciones, y después se
vuelve al pueblo.

## Entrenamiento persistente

Hay **dos niveles independientes**. El **nivel de la partida** empieza en 1,
sube al recoger XP y da mejoras temporales de estadísticas; tanto el nivel como
esas mejoras se reinician en cada partida. No desbloquea movimientos ni evoluciones.
Los objetos siguen funcionando y los movimientos ya empiezan vinculados, pero
no se consiguen, mejoran ni evolucionan ataques con las cartas de nivel.

El **nivel permanente de Pokémon** empieza en 1 y llega hasta 100. Solo gana XP
al terminar una partida (también al salir desde la pausa), según el tiempo
sobrevivido y los Pokémon derrotados, con un extra por jefes. Desbloquea movimientos
y evoluciones a sus niveles oficiales y aumenta las estadísticas iniciales.
Del nivel 1 al 100, HP, Ataque, Ataque Especial, Defensa y Defensa Especial
crecen de forma lineal hasta +50%; Velocidad, hasta +15%. La naturaleza aplica
una sola vez su +10% y -10% habituales, sin IV ni EV. Se usan estadísticas
adaptadas al juego de supervivencia, no la fórmula oficial de estadísticas.
La XP de las esferas y los multiplicadores temporales solo afectan al nivel
de la partida. Se conserva toda la XP permanente que ya tenías.

**Entrenamiento** reúne estadísticas, naturaleza, habilidad, movimientos y
compras en una pantalla, con pestañas **Movimientos** y **Ventajas**.
Las Pokémonedas compran recarga, regeneración, recogida, aprendizaje,
monedas, críticos y cambios de cartas; ya no compran HP, ataques, defensas
ni velocidad. Las antiguas compras de esas estadísticas no tienen efecto
y no se reembolsan. Mentas y Cápsulas siguen consumiendo objetos de la mochila.
**Aprendizaje** da +5% por rango (hasta ocho) tanto a la XP de partida como a
los puntos de rendimiento que se convierten en XP permanente. Se toma el rango
comprado al empezar la partida; Huevo Suerte y los demás multiplicadores
temporales no aumentan la XP permanente.

El rendimiento se convierte primero en
`floor(segundos / 2 + sqrt(segundos × derrotados) / 4 + jefes × 15)` puntos.
Después se aplica el multiplicador comprado de Aprendizaje, antes de convertir
esos puntos en XP.
El extra por derrotados tiene rendimientos decrecientes para que las grandes
hordas no disparen los niveles; dividir una partida en varias no aumenta sus
puntos totales para el mismo rendimiento. Los puntos se convierten en XP usando
la curva oficial de cada especie: antes del nivel 10, cada punto da
`max(1, XP oficial del nivel 10 / 600)` XP; desde el 10 da
`1 + (nivel - 10) / 3` XP. La conversión se recalcula al cruzar cada nivel
y solo se redondea hacia abajo al guardar la XP final.

Al terminar hay **dos pantallas**: primero, los resultados de la partida
(tiempo, nivel temporal, derrotados, recompensas y resumen de daño); al pulsar
**Continuar a XP permanente**, aparece el progreso del Pokémon con la XP ganada,
el cambio de nivel permanente y los nuevos movimientos. Puedes volver a consultar
los resultados sin recibir XP adicional. Las evoluciones disponibles se presentan
desde esta segunda pantalla antes de volver al menú.

La referencia de equilibrio es **nivel 10 en unos 10–15 minutos** entre partidas
cortas y **nivel 36 en unas 2–3 horas** para un inicial típico. Por ejemplo,
partidas de 5 minutos con 150 derrotados y 2 jefes llegan al 10 en 15 minutos
y al 36 en unos 160 minutos; las de 3 minutos con 60 derrotados y 1 jefe
tardan 15 y 171 minutos. No son plazos garantizados: dependen del rendimiento
y del grupo de crecimiento, que sigue siendo distinto después del nivel 10.

En **Entrenamiento**, o al pulsar **Jugar**, eliges entre uno y **cuatro
movimientos distintos**, con al menos un ataque. Se equipan desde el inicio de
la partida y no se cambian mientras juegas. Todos los movimientos oficiales de
su nivel inicial que estén implementados están disponibles desde el principio,
con hasta cuatro equipados. Subir de nivel desbloquea opciones
para elegir después: no sustituye automáticamente tu equipo. La versión normal
y shiny comparten nivel y movimientos.

Los movimientos de apoyo incluyen **Rizo Defensa**, **Refugio**, **Defensa Férrea**,
**Rizo Algodón** y **Armadura Ácida**, que reutilizan Fortaleza, y **Afilar**,
**Meditación** y **Aullido**, que reutilizan Danza Espada.
Mantienen las mejoras temporales acumulables del juego, no un sistema nuevo de
niveles de estadísticas: hasta cinco acumulaciones durante siete segundos,
con +7 puntos porcentuales de reducción de daño o +13% de Ataque físico por
acumulación. Los movimientos del mismo atributo comparten esas acumulaciones.
Cada especie solo desbloquea los
movimientos y niveles oficiales de su versión de referencia; no se asigna un
apoyo arbitrario a todos los Pokémon. Afilar y Meditación están implementados,
pero no tienen aprendices en las versiones actualmente seleccionadas.

**Desarrollo** y **Avivar** acumulan Ataque físico y Ataque Especial a la vez
(+6,5% de cada uno por acumulación); **Corpulencia** acumula Ataque físico (+6,5%)
y reducción de daño (+3,5 puntos porcentuales). En todos los niveles del
movimiento, cada efecto dual tiene la mitad de la potencia del apoyo individual
correspondiente. Comparten con los otros apoyos las acumulaciones de cada
atributo, el máximo inicial de cinco y la duración inicial de siete segundos.
Los apoyos individuales y las mejoras por nivel no cambian. Se adaptan al
equilibrio existente, sin efectos adicionales por clima ni niveles de
estadísticas oficiales. Que una especie no tenga apoyos implementados no
significa que carezca de movimientos de mejora en los juegos oficiales.

Los demás apoyos reutilizan exclusivamente esas mismas mejoras del juego:

| Efecto existente | Nuevos movimientos |
| --- | --- |
| Danza Espada: Ataque físico | Afilagarras, Tambor |
| Maquinación: Ataque Especial | Luminicola |
| Agilidad: Velocidad | Pulimento, Aligerar, Viento Afín |
| Fortaleza: reducción de daño | Amnesia, Masa Cósmica, Reserva, Carga, Barrera, Retracción, A Defender |
| Ataque físico + reducción de daño | Enrosque |
| Ataque Especial + reducción de daño | Paz Mental |
| Ataque físico + Velocidad | Cambio de Marcha, Limpieza General |
| Acua Aro: regeneración | Arraigo, Recuperación, Relajo, Batido, Respiro, Fotosíntesis, Sol Matinal, Luz Lunar, Recogearena, Descanso, Ovocuración, Auxilio |

Cada efecto dual conserva la mitad de la potencia individual: +6,5% de Ataque
físico o Especial, +5% de Velocidad y +3,5 puntos porcentuales de reducción de
daño por acumulación inicial. Los apoyos regenerativos copian Acua Aro sin
curación instantánea: +1,6 PS por segundo por acumulación, hasta cuatro,
durante ocho segundos, con el mismo efecto visual de burbujas y la misma
reserva compartida. Los demás apoyos mantienen los tiempos, límites y mejoras
de su plantilla original.

Solo cambian el nombre, el tipo oficial y, para los duales, la combinación de
efectos existentes. No añaden precisión, evasión, críticos, costes de PS,
sueño, bonificaciones climáticas, efectos de equipo ni eliminación de estados,
trampas o Sustitutos. Barrera, Retracción y Auxilio no tienen aprendices en las
versiones seleccionadas; no se inventan movimientos para hacerlos disponibles.

### Evoluciones

Las evoluciones por nivel usan sus **niveles oficiales**: Charmander al 16,
Charmeleon al 36, Magikarp al 20, etc. Solo se ofrecen en la **pantalla de XP y
resultados al terminar la partida**, cuando esa recompensa hace subir el nivel
del Pokémon. No se activan al abrir el menú, Entrenamiento ni al preparar otra
partida. Si una recompensa supera varios niveles, se ofrece la evolución al
nivel alcanzado; también se pueden encadenar varias etapas si ya se cumplen sus
requisitos. Si el Pokémon ya había alcanzado el requisito, debe subir otro nivel
con la recompensa de una partida para recibir la oferta.

La animación clásica alterna las siluetas de ambas formas. Puedes pulsar
**Detener evolución**, `B` o `Esc`: el Pokémon conserva su forma y vuelve a
intentarlo **al subir otro nivel**, no al comenzar otra partida ni al recargar.
La opción **Animación suave** elimina los destellos y también se respetan las
preferencias de movimiento reducido del dispositivo.

Al evolucionar se **reemplaza la forma anterior**, conservando nivel, XP,
movimientos aprendidos, shiny, mejoras, naturaleza y posición de habilidad.
Los movimientos aprendidos antes de evolucionar siguen disponibles aunque no
estén en la lista de nivel de la nueva especie. Si ya tenías la especie de
destino, se conservan la XP y las mejoras máximas. Puedes volver a conseguir la
forma base en el gacha; empezará un entrenamiento nuevo en nivel 1.

El **gacha solo entrega formas base**, tanto normales como shiny, en todos sus
banners y tamaños de tirada. Las formas evolucionadas que ya tenías no se
eliminan. Las probabilidades mostradas reflejan los grupos disponibles; si falta
una rareza, se busca la más cercana, prefiriendo la superior para mantener la
garantía de Épica o superior. Evolucionar no quita el progreso de colección de
esa familia para el Amuleto Iris.

Por ahora se incluyen **317 evoluciones exclusivamente por nivel**. Las piedras,
intercambios, amistad y requisitos especiales (hora, sexo, estadísticas,
movimientos conocidos, versión o formas regionales) quedan pendientes; no se
inventan niveles para sustituirlos.

Esta primera versión usa los **103 movimientos de combate ya implementados**:
no incluye todos los ataques de los juegos oficiales y mantiene su adaptación al
combate de supervivencia. Sus especies compatibles y niveles proceden de
**Escarlata/Púrpura**, o del juego oficial más reciente disponible en los datos si
la especie no aparece allí. La pantalla muestra el juego de origen. Las MT
aprendidas se pueden equipar si son compatibles. Si todavía no hay un ataque
implementado disponible (por ejemplo, Magikarp antes del nivel 15), se ofrece
**Forcejeo** como ataque de emergencia, no como movimiento de su lista oficial.

Las cuentas anteriores migran sin perder sus otros datos. Se conservan las
preferencias de ataques legales cuando es posible. Las antiguas compras de
huecos, ataques iniciales y vetos permanecen en el guardado, pero quedan
inactivas y no se reembolsan. Al fusionar cuentas/dispositivos se conserva la
**XP máxima por especie**, no se suman sesiones paralelas; el equipo se resuelve
por su fecha de edición.

### Datos y comprobaciones

`js/training.js` contiene el modelo legible y la integración; `js/app.min.js`
conserva el motor existente con hooks puntuales. `js/data/learnsets.js` incluye
los datos de movimientos, ascendencia y evoluciones sin consultas a PokeAPI
durante el juego. La revisión de origen y su licencia están en [CREDITS.md](CREDITS.md).

```sh
# Python 3; descarga CSV de una revisión fija de PokeAPI.
python tools/generate_learnsets.py
# O reutiliza los CSV descargados:
python tools/generate_learnsets.py --csv-dir /ruta/a/csv
# Node.js 18+, sin dependencias adicionales:
node --test tests/*.test.cjs
```

## Guardado en la nube y publicación

- **Base de datos (Firebase):** cuentas con nombre + contraseña o Google, y la
  partida se sigue en cualquier ordenador.
  Las cuentas locales guardan sólo en el navegador; los invitados no guardan.
- **Jugar con amigos (hasta 4) y ranking:** con cuenta en la nube, menú
  **Amigos** (añadir por apodo, invitar a tu sala) y **Ranking** (tiempo
  aguantado: solo o grupo, de hoy a histórico, amigos, por Pokémon).
- Si se juega en dos ordenadores a la vez o sin conexión, las partidas se
  **fusionan**: las colecciones se unen (nunca se pierde un Pokémon ni un
  shiny), mejoras y estadísticas se quedan con el máximo, y monedas y
  compañero con la versión más reciente. Los cambios de otro ordenador llegan
  en directo.

## Licencia

Código bajo [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md) desde el
14-10-2026: se puede usar, estudiar y modificar, pero **no con fines
comerciales** (ni vender el juego ni cobrar nada dentro de él). Las versiones
hasta el commit `b297089` se publicaron bajo MIT. Los sprites (CC BY-NC 4.0),
la fuente (OFL) y las marcas de Pokémon tienen sus propias condiciones: ver
[LICENSE](LICENSE) y [CREDITS.md](CREDITS.md). Proyecto de fan sin ánimo de
lucro.

**La única web oficial es [pokesurvivor.com](https://pokesurvivor.com).** El
juego es y será gratis: si alguien te pide pagar, no somos nosotros.

## Créditos y licencia

Sprites de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) bajo
**CC BY-NC 4.0** — uso **no comercial** y con atribución; la lista de artistas
está en [`CREDITS.md`](CREDITS.md). Pokémon es propiedad de Nintendo, Creatures
Inc. y GAME FREAK. Proyecto de fan sin ánimo de lucro.
