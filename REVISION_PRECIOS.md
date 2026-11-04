# Revisión de correspondencias y precios

Se cargaron sin inventar importes los datos visibles de `Productos-1.pdf` (51 filas) y `Catálogo_Mayorista_Celulab.pdf` (12 familias mayoristas). La tienda presenta **15 familias únicas**: cuatro familias agrupadas por modelo, tres referencias sueltas minoristas y ocho familias mayoristas adicionales.

## Coincidencias integradas

- Funda Magsafe iPhone / Fundas MagSafe Transparente: minorista $6.500; mayorista x10 $2.700, x50 $2.600, x100 $2.550, x200 $2.500.
- Silicone case / Fundas de silicona con logo: minorista $6.500; mayorista x10 $3.100, x50 $2.900, x100 $2.800, x200 $2.700.
- Vidrio 9D / Glass 9D: minorista $5.000; mayorista x10 $790, x50 $750, x100 $710, x200 $690.
- Vidrio Antiespia / Glass Antiespia: minorista $5.000; mayorista x10 $1.350, x50 $1.310, x100 $1.280, x200 $1.250.

## Descripciones no idénticas — se mantienen separadas por precaución

| Productos-1.pdf | Catálogo mayorista | Motivo |
|---|---|---|
| Cargador iP 20W (Arg), $12.000 minorista; x10 y x50 $5.800 | Cargadores 20 W AAA (Arg), x10 $5.800 y x50 $5.500 | El PDF minorista no aclara calidad AAA y los precios x50 difieren. |
| Cable USB-C / C, $6.000 minorista; x10 y x50 $2.900 | Cable C a C Mallado AAA, x10 $2.900 y x50 $2.750 | No se confirmó si el cable minorista es mallado ni AAA. |
| Cable USB-C / Lightning, $4.300 minorista; x10 y x50 $3.300 | Cables C a Lightning AAA, x10 $3.300 y x50 $3.200 | No se confirmó si es AAA y x50 difiere. |

Al confirmarse que son el mismo producto, se podrá fusionar cada pareja en el panel y usar las cuatro escalas. Sin confirmación no corresponde asignar 100 y 200 unidades a las referencias minoristas.

## Faltantes originales

- `Funda Antishock`, `Cargador 20 W AAA (Eu)`, `Cargador 20 W Original`, `Air Pods Pro 2 AAA`, `Air Pods Pro 3 AAA`, y referencias mayoristas separadas no muestran precio minorista porque no figura en los dos PDFs.
- No hay stock real ni fotografías detalladas por modelo en los catálogos.
- Las variantes de productos que figuran solo en el mayorista necesitan confirmación de modelos específicos.

## Reglas de pedido

El mínimo **$70.000** se aplica a la suma mayorista del carrito, y el primer precio mayorista requiere 10 unidades dentro de una misma familia (pueden combinarse modelos de esa familia). El carrito permite recalcular las escalas cuando cambia la cantidad. La integración de stock compartido y pagos reales queda para la siguiente etapa.
