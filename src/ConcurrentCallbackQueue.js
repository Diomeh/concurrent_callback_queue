// noinspection JSUnusedGlobalSymbols

/**
 * Opciones de configuración de la cola
 *
 * @typedef {Object} QueueOptions
 * @property {boolean} autoStart - Indica si la cola debe iniciar su ejecución automáticamente al agregar un callback
 * @property {number} maxConcurrent - Cantidad máxima de callbacks que se pueden ejecutar en paralelo
 * @property {Function} onCallbackError - Callback que se ejecuta cuando ocurre un error al ejecutar un callback, recibe como
 * parámetro el error que se produjo
 * @property {Function} onCallbackSuccess - Callback que se ejecuta después de que un callback se ejecuta correctamente
 * @property {Function} onQueueIdle - Callback que se ejecuta cuando la cola pasa a estado IDLE
 * @property {Function} onQueueBusy - Callback que se ejecuta cuando la cola pasa a estado BUSY
 * @property {Function} onQueueStop - Callback que se ejecuta cuando la cola se detiene
 */

/**
 * Opciones por defecto de la cola
 *
 * @type {QueueOptions}
 */
const defaultQueueOptions = {
    autoStart: true,
    maxConcurrent: 10,
    onCallbackError: null,
    onCallbackSuccess: null,
    onQueueIdle: null,
    onQueueBusy: null,
    onQueueStop: null,
};

/**
 * Enumera los estados en que se puede encontrar la cola
 *
 * @type {{IDLE: string, BUSY: string, STOPPED: string}}
 */
const QueueState = {
    IDLE: 'IDLE',
    BUSY: 'BUSY',
    STOPPED: 'STOPPED',
};

/**
 * Cola de callbacks que se ejecutan de forma concurrente
 *
 * @class ConcurrentCallbackQueue
 * @example
 * const queue = new ConcurrentCallbackQueue({
 *     autoStart: false,
 *     maxConcurrent: 2,
 *     onCallbackError: (error) => console.error(error),
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     queue.enqueue(() => {
 *         const uri = 'https://httpstat.us/200,400?sleep=2000';
 *         return $.get(uri).done(() => {
 *             console.log(`Request ${i+1} completed`);
 *         });
 *     }, 3);
 * }
 *
 * queue.start();
 *
 * @author David Urbina
 * @version 1.0.0
 * @since 2023-03-23
 */
class ConcurrentCallbackQueue {
    /**
     * Cola de callbacks pendientes a ejecutar de forma concurrente
     *
     * @type {Array<Function>}
     * @private
     */
    #pending;

    /**
     * Callbacks en ejecución
     *
     * @type {Map<number, Function>}
     * @private
     */
    #running;

    /**
     * Estado en que se encuentra la cola
     *
     * @type {string}
     * @private
     */
    #state;

    /**
     * Cantidad de callbacks que se están ejecutando en este momento
     *
     * @type {number}
     * @private
     */
    #concurrent;

    /**
     * Opciones de configuración de la cola
     *
     * @type {QueueOptions}
     * @private
     */
    #options;

    /**
     * Crea una nueva cola de callbacks concurrentes.
     *
     * @param {QueueOptions} options - Opciones de configuración de la cola.
     */
    constructor(options = defaultQueueOptions) {
        this.#pending = [];
        this.#running = new Map();
        this.#state = QueueState.IDLE;
        this.#concurrent = 0;
        this.#initOptions(options);
    }

    /**
     * Función vacía que se usa como callback por defecto.
     *
     * @returns {void}
     * @private
     */
    #noop = () => {};

    /**
     * Inicializa las opciones de configuración de la cola, se mezclan las opciones por defecto con las opciones recibidas.
     *
     * @param {QueueOptions} options - Opciones de configuración de la cola.
     */
    #initOptions(options) {
        this.#options = {
            ...defaultQueueOptions,
            ...options,
        };

        // seteamos un noop a los callbacks que no se hayan especificado para evitar verificar si son funciones en cada llamada
        this.#options.onCallbackError = typeof options.onCallbackError === 'function' ? options.onCallbackError : this.#noop;
        this.#options.onCallbackSuccess = typeof options.onCallbackSuccess === 'function' ? options.onCallbackSuccess : this.#noop;
        this.#options.onQueueIdle = typeof options.onQueueIdle === 'function' ? options.onQueueIdle : this.#noop;
        this.#options.onQueueBusy = typeof options.onQueueBusy === 'function' ? options.onQueueBusy : this.#noop;
        this.#options.onQueueStop = typeof options.onQueueStop === 'function' ? options.onQueueStop : this.#noop;
    }

    /**
     * Agrega un callback a la cola, si autoStart está activado se inicia la ejecución de la cola.
     * Puede especificar un número opcional de reintentos en caso de error.
     *
     * @param {Function} callback - La función de callback a agregar a la cola.
     * @param {number} [retries=0] - Número de intentos de reintentos en caso de error (opcional).
     * @returns {void}
     * @throws {Error} Si el callback no es una función o retries no es un número.
     *
     * @public
     */
    enqueue(callback, retries = 0) {
        if (typeof callback !== 'function') {
            throw new Error('El callback debe ser una función')
        }

        if (typeof retries !== 'number') {
            throw new Error('El parámetro retries debe ser un número');
        }
        if (retries < 0) {
            throw new Error('El parámetro retries debe ser un número positivo');
        }

        const retryCallback = async (currentRetry) => {
            try {
                await callback();
            } catch (error) {
                if (currentRetry < retries) {
                    console.warn(`Error ejecutando callback. Reintentando (${currentRetry + 1}/${retries})...`);
                    await retryCallback(currentRetry + 1);
                } else {
                    this.#handleError(error);
                }
            }
        };

        this.#pending.push(() => retryCallback(0));
        if (this.#options.autoStart) {
            this.start();
        }
    }

    /**
     * Agrega varios callbacks a la cola, si autoStart está activado se inicia la ejecución de la cola.
     * Puede especificar un número opcional de intentos de reintentos en caso de error.
     *
     * @param {Array<Function>} callbacks - El array de funciones de callback a agregar a la cola.
     * @param {number} [retries=0] - Número de intentos de reintentos en caso de error para todos los callbacks (opcional).
     * @returns {void}
     * @throws {Error} Si callbacks no es un array de funciones o retries no es un número.
     *
     * @public
     */
    enqueueAll(callbacks, retries = 0) {
        if (!Array.isArray(callbacks)) {
            throw new Error('El parámetro debe ser un array de funciones');
        }

        if (!callbacks.every(callback => typeof callback === 'function')) {
            throw new Error('El parámetro debe ser un array de funciones');
        }

        if (typeof retries !== 'number') {
            throw new Error('El parámetro retries debe ser un número');
        }
        if (retries < 0) {
            throw new Error('El parámetro retries debe ser un número positivo');
        }

        const retryCallbacks = callbacks.map(callback => {
            const retryCallback = async (currentRetry) => {
                try {
                    await callback();
                } catch (error) {
                    if (currentRetry < retries) {
                        console.warn(`Error ejecutando callback. Reintentando (${currentRetry + 1}/${retries})...`);
                        await retryCallback(currentRetry + 1);
                    } else {
                        this.#handleError(error);
                    }
                }
            };

            return () => retryCallback(0);
        });

        this.#pending.push(...retryCallbacks);

        if (this.#options.autoStart) {
            this.start();
        }
    }

    /**
     * Inicia la ejecución de la cola.
     *
     * Si en algún momento la cola es detenida y luego se vuelve a poner en marcha,
     * se reanuda la ejecución desde el último callback que estaba pendiente de ejecución.
     *
     * @returns {void}
     * @public
     */
    start() {
        if (this.#state === QueueState.BUSY || this.#pending.length === 0) {
            return;
        }

        this.#state = QueueState.BUSY;
        this.#processIfNecessary();
    }

    /**
     * Ejecuta de forma concurrente los callbacks de la cola.
     *
     * @returns {void}
     * @private
     */
    #process() {
        while (this.#shouldProcess()) {
            const callback = this.#pending.shift();
            this.#concurrent++;
            const index = Date.now();
            this.#running.set(index, callback);

            Promise.resolve()
                .then(() => callback())
                .then(() => this.#options.onCallbackSuccess())
                .catch((error) => this.#handleError(error))
                .finally(() => {
                    this.#concurrent--;
                    this.#running.delete(index);
                    this.#processIfNecessary();
                });
        }

        // Check if the queue is now idle or busy
        if (this.#state === QueueState.IDLE) {
            this.#options.onQueueIdle();
        } else if (this.#state === QueueState.BUSY) {
            this.#options.onQueueBusy();
        } else if (this.#state === QueueState.STOPPED) {
            this.#options.onQueueStop();
        }
    }

    /**
     * Maneja errores que ocurren durante la ejecución de un callback.
     *
     * @param {Error} error - El objeto de error.
     * @returns {void}
     * @private
     */
    #handleError(error) {
        this.#options.onCallbackError(error);
    }

    /**
     * Determina si se debe procesar la cola
     *
     * @returns {boolean} Verdadero si se debe procesar la cola, falso en caso contrario
     * @private
     */
    #shouldProcess() {
        return this.#state === QueueState.BUSY
            && this.#concurrent < this.#options.maxConcurrent
            && this.#pending.length > 0;
    }

    /**
     * Revisa el estado de la cola y la procesa si es necesario.
     *
     * @returns {void}
     * @private
     */
    #processIfNecessary() {
        if (this.#state === QueueState.BUSY) {
            if (this.#pending.length > 0) {
                this.#process();
            } else if (this.#concurrent === 0) {
                this.stop();
            }
        }
    }

    /**
     * Detiene la ejecución de la cola, pero no elimina los callbacks pendientes de ejecución.
     *
     * Llamar a este método no detendrá la ejecución de los callbacks que ya se están procesando,
     * tampoco se eliminan los callbacks pendientes de ejecución, por lo que si se vuelve
     * a iniciar la cola, se reanudará desde el último callback que estaba pendiente.
     *
     * @returns {void}
     * @public
     */
    stop() {
        this.#state = QueueState.IDLE;
    }

    /**
     * Detiene la ejecución de la cola y elimina todos los callbacks de la misma.
     *
     * @returns {Array<Function>} Lista de callbacks pendientes de ejecución
     * @public
     */
    clear() {
        this.stop();
        return this.dequeueAll();
    }

    /**
     * Elimina un callback pendiente de ejecución de la cola, sin detener la ejecución de la misma.
     *
     * @return {Function} Callback eliminado
     * @public
     */
    dequeue() {
        return this.#pending.shift();
    }

    /**
     * Elimina todos los callbacks pendientes de ejecución de la cola, sin detener la ejecución de la misma.
     *
     * @returns {Array<Function>} Lista de callbacks pendientes de ejecución
     * @public
     */
    dequeueAll() {
        const queue = this.#pending;
        this.#pending = [];
        return queue;
    }

    /**
     * Devuelve el estado actual de la cola.
     *
     * @returns {string}
     */
    getState() {
        return this.#state;
    }
}
