
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * @typedef {Object} WrappedComponent Object returned by the `wrap` method
     * @property {SvelteComponent} component - Component to load (this is always asynchronous)
     * @property {RoutePrecondition[]} [conditions] - Route pre-conditions to validate
     * @property {Object} [props] - Optional dictionary of static props
     * @property {Object} [userData] - Optional user data dictionary
     * @property {bool} _sveltesparouter - Internal flag; always set to true
     */

    /**
     * @callback AsyncSvelteComponent
     * @returns {Promise<SvelteComponent>} Returns a Promise that resolves with a Svelte component
     */

    /**
     * @callback RoutePrecondition
     * @param {RouteDetail} detail - Route detail object
     * @returns {boolean|Promise<boolean>} If the callback returns a false-y value, it's interpreted as the precondition failed, so it aborts loading the component (and won't process other pre-condition callbacks)
     */

    /**
     * @typedef {Object} WrapOptions Options object for the call to `wrap`
     * @property {SvelteComponent} [component] - Svelte component to load (this is incompatible with `asyncComponent`)
     * @property {AsyncSvelteComponent} [asyncComponent] - Function that returns a Promise that fulfills with a Svelte component (e.g. `{asyncComponent: () => import('Foo.svelte')}`)
     * @property {SvelteComponent} [loadingComponent] - Svelte component to be displayed while the async route is loading (as a placeholder); when unset or false-y, no component is shown while component
     * @property {object} [loadingParams] - Optional dictionary passed to the `loadingComponent` component as params (for an exported prop called `params`)
     * @property {object} [userData] - Optional object that will be passed to events such as `routeLoading`, `routeLoaded`, `conditionsFailed`
     * @property {object} [props] - Optional key-value dictionary of static props that will be passed to the component. The props are expanded with {...props}, so the key in the dictionary becomes the name of the prop.
     * @property {RoutePrecondition[]|RoutePrecondition} [conditions] - Route pre-conditions to add, which will be executed in order
     */

    /**
     * Wraps a component to enable multiple capabilities:
     * 1. Using dynamically-imported component, with (e.g. `{asyncComponent: () => import('Foo.svelte')}`), which also allows bundlers to do code-splitting.
     * 2. Adding route pre-conditions (e.g. `{conditions: [...]}`)
     * 3. Adding static props that are passed to the component
     * 4. Adding custom userData, which is passed to route events (e.g. route loaded events) or to route pre-conditions (e.g. `{userData: {foo: 'bar}}`)
     * 
     * @param {WrapOptions} args - Arguments object
     * @returns {WrappedComponent} Wrapped component
     */
    function wrap$1(args) {
        if (!args) {
            throw Error('Parameter args is required')
        }

        // We need to have one and only one of component and asyncComponent
        // This does a "XNOR"
        if (!args.component == !args.asyncComponent) {
            throw Error('One and only one of component and asyncComponent is required')
        }

        // If the component is not async, wrap it into a function returning a Promise
        if (args.component) {
            args.asyncComponent = () => Promise.resolve(args.component);
        }

        // Parameter asyncComponent and each item of conditions must be functions
        if (typeof args.asyncComponent != 'function') {
            throw Error('Parameter asyncComponent must be a function')
        }
        if (args.conditions) {
            // Ensure it's an array
            if (!Array.isArray(args.conditions)) {
                args.conditions = [args.conditions];
            }
            for (let i = 0; i < args.conditions.length; i++) {
                if (!args.conditions[i] || typeof args.conditions[i] != 'function') {
                    throw Error('Invalid parameter conditions[' + i + ']')
                }
            }
        }

        // Check if we have a placeholder component
        if (args.loadingComponent) {
            args.asyncComponent.loading = args.loadingComponent;
            args.asyncComponent.loadingParams = args.loadingParams || undefined;
        }

        // Returns an object that contains all the functions to execute too
        // The _sveltesparouter flag is to confirm the object was created by this router
        const obj = {
            component: args.asyncComponent,
            userData: args.userData,
            conditions: (args.conditions && args.conditions.length) ? args.conditions : undefined,
            props: (args.props && Object.keys(args.props).length) ? args.props : {},
            _sveltesparouter: true
        };

        return obj
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    function parse(str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.38.3 */

    const { Error: Error_1, Object: Object_1, console: console_1 } = globals;

    // (251:0) {:else}
    function create_else_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(251:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (244:0) {#if componentParams}
    function create_if_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
    					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(244:0) {#if componentParams}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*componentParams*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function wrap(component, userData, ...conditions) {
    	// Use the new wrap method and show a deprecation warning
    	// eslint-disable-next-line no-console
    	console.warn("Method `wrap` from `svelte-spa-router` is deprecated and will be removed in a future version. Please use `svelte-spa-router/wrap` instead. See http://bit.ly/svelte-spa-router-upgrading");

    	return wrap$1({ component, userData, conditions });
    }

    /**
     * @typedef {Object} Location
     * @property {string} location - Location (page/view), for example `/book`
     * @property {string} [querystring] - Querystring from the hash, as a string not parsed
     */
    /**
     * Returns the current location from the hash.
     *
     * @returns {Location} Location object
     * @private
     */
    function getLocation() {
    	const hashPosition = window.location.href.indexOf("#/");

    	let location = hashPosition > -1
    	? window.location.href.substr(hashPosition + 1)
    	: "/";

    	// Check if there's a querystring
    	const qsPosition = location.indexOf("?");

    	let querystring = "";

    	if (qsPosition > -1) {
    		querystring = location.substr(qsPosition + 1);
    		location = location.substr(0, qsPosition);
    	}

    	return { location, querystring };
    }

    const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	set(getLocation());

    	const update = () => {
    		set(getLocation());
    	};

    	window.addEventListener("hashchange", update, false);

    	return function stop() {
    		window.removeEventListener("hashchange", update, false);
    	};
    });

    const location = derived(loc, $loc => $loc.location);
    const querystring = derived(loc, $loc => $loc.querystring);
    const params = writable(undefined);

    async function push(location) {
    	if (!location || location.length < 1 || location.charAt(0) != "/" && location.indexOf("#/") !== 0) {
    		throw Error("Invalid parameter location");
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	// Note: this will include scroll state in history even when restoreScrollState is false
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	window.location.hash = (location.charAt(0) == "#" ? "" : "#") + location;
    }

    async function pop() {
    	// Execute this code when the current call stack is complete
    	await tick();

    	window.history.back();
    }

    async function replace(location) {
    	if (!location || location.length < 1 || location.charAt(0) != "/" && location.indexOf("#/") !== 0) {
    		throw Error("Invalid parameter location");
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	const dest = (location.charAt(0) == "#" ? "" : "#") + location;

    	try {
    		const newState = { ...history.state };
    		delete newState["__svelte_spa_router_scrollX"];
    		delete newState["__svelte_spa_router_scrollY"];
    		window.history.replaceState(newState, undefined, dest);
    	} catch(e) {
    		// eslint-disable-next-line no-console
    		console.warn("Caught exception while replacing the current page. If you're running this in the Svelte REPL, please note that the `replace` method might not work in this environment.");
    	}

    	// The method above doesn't trigger the hashchange event, so let's do that manually
    	window.dispatchEvent(new Event("hashchange"));
    }

    function link(node, opts) {
    	opts = linkOpts(opts);

    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != "a") {
    		throw Error("Action \"link\" can only be used with <a> tags");
    	}

    	updateLink(node, opts);

    	return {
    		update(updated) {
    			updated = linkOpts(updated);
    			updateLink(node, updated);
    		}
    	};
    }

    // Internal function used by the link function
    function updateLink(node, opts) {
    	let href = opts.href || node.getAttribute("href");

    	// Destination must start with '/' or '#/'
    	if (href && href.charAt(0) == "/") {
    		// Add # to the href attribute
    		href = "#" + href;
    	} else if (!href || href.length < 2 || href.slice(0, 2) != "#/") {
    		throw Error("Invalid value for \"href\" attribute: " + href);
    	}

    	node.setAttribute("href", href);

    	node.addEventListener("click", event => {
    		// Prevent default anchor onclick behaviour
    		event.preventDefault();

    		if (!opts.disabled) {
    			scrollstateHistoryHandler(event.currentTarget.getAttribute("href"));
    		}
    	});
    }

    // Internal function that ensures the argument of the link action is always an object
    function linkOpts(val) {
    	if (val && typeof val == "string") {
    		return { href: val };
    	} else {
    		return val || {};
    	}
    }

    /**
     * The handler attached to an anchor tag responsible for updating the
     * current history state with the current scroll state
     *
     * @param {string} href - Destination
     */
    function scrollstateHistoryHandler(href) {
    	// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	// This will force an update as desired, but this time our scroll state will be attached
    	window.location.hash = href;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Router", slots, []);
    	let { routes = {} } = $$props;
    	let { prefix = "" } = $$props;
    	let { restoreScrollState = false } = $$props;

    	/**
     * Container for a route: path, component
     */
    	class RouteItem {
    		/**
     * Initializes the object and creates a regular expression from the path, using regexparam.
     *
     * @param {string} path - Path to the route (must start with '/' or '*')
     * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
     */
    		constructor(path, component) {
    			if (!component || typeof component != "function" && (typeof component != "object" || component._sveltesparouter !== true)) {
    				throw Error("Invalid component object");
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == "string" && (path.length < 1 || path.charAt(0) != "/" && path.charAt(0) != "*") || typeof path == "object" && !(path instanceof RegExp)) {
    				throw Error("Invalid value for \"path\" argument - strings must start with / or *");
    			}

    			const { pattern, keys } = parse(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == "object" && component._sveltesparouter === true) {
    				this.component = component.component;
    				this.conditions = component.conditions || [];
    				this.userData = component.userData;
    				this.props = component.props || {};
    			} else {
    				// Convert the component to a function that returns a Promise, to normalize it
    				this.component = () => Promise.resolve(component);

    				this.conditions = [];
    				this.props = {};
    			}

    			this._pattern = pattern;
    			this._keys = keys;
    		}

    		/**
     * Checks if `path` matches the current route.
     * If there's a match, will return the list of parameters from the URL (if any).
     * In case of no match, the method will return `null`.
     *
     * @param {string} path - Path to test
     * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
     */
    		match(path) {
    			// If there's a prefix, check if it matches the start of the path.
    			// If not, bail early, else remove it before we run the matching.
    			if (prefix) {
    				if (typeof prefix == "string") {
    					if (path.startsWith(prefix)) {
    						path = path.substr(prefix.length) || "/";
    					} else {
    						return null;
    					}
    				} else if (prefix instanceof RegExp) {
    					const match = path.match(prefix);

    					if (match && match[0]) {
    						path = path.substr(match[0].length) || "/";
    					} else {
    						return null;
    					}
    				}
    			}

    			// Check if the pattern matches
    			const matches = this._pattern.exec(path);

    			if (matches === null) {
    				return null;
    			}

    			// If the input was a regular expression, this._keys would be false, so return matches as is
    			if (this._keys === false) {
    				return matches;
    			}

    			const out = {};
    			let i = 0;

    			while (i < this._keys.length) {
    				// In the match parameters, URL-decode all values
    				try {
    					out[this._keys[i]] = decodeURIComponent(matches[i + 1] || "") || null;
    				} catch(e) {
    					out[this._keys[i]] = null;
    				}

    				i++;
    			}

    			return out;
    		}

    		/**
     * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
     * @typedef {Object} RouteDetail
     * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
     * @property {string} location - Location path
     * @property {string} querystring - Querystring from the hash
     * @property {object} [userData] - Custom data passed by the user
     * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
     * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
     */
    		/**
     * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
     * 
     * @param {RouteDetail} detail - Route detail
     * @returns {boolean} Returns true if all the conditions succeeded
     */
    		async checkConditions(detail) {
    			for (let i = 0; i < this.conditions.length; i++) {
    				if (!await this.conditions[i](detail)) {
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// Set up all routes
    	const routesList = [];

    	if (routes instanceof Map) {
    		// If it's a map, iterate on it right away
    		routes.forEach((route, path) => {
    			routesList.push(new RouteItem(path, route));
    		});
    	} else {
    		// We have an object, so iterate on its own properties
    		Object.keys(routes).forEach(path => {
    			routesList.push(new RouteItem(path, routes[path]));
    		});
    	}

    	// Props for the component to render
    	let component = null;

    	let componentParams = null;
    	let props = {};

    	// Event dispatcher from Svelte
    	const dispatch = createEventDispatcher();

    	// Just like dispatch, but executes on the next iteration of the event loop
    	async function dispatchNextTick(name, detail) {
    		// Execute this code when the current call stack is complete
    		await tick();

    		dispatch(name, detail);
    	}

    	// If this is set, then that means we have popped into this var the state of our last scroll position
    	let previousScrollState = null;

    	let popStateChanged = null;

    	if (restoreScrollState) {
    		popStateChanged = event => {
    			// If this event was from our history.replaceState, event.state will contain
    			// our scroll history. Otherwise, event.state will be null (like on forward
    			// navigation)
    			if (event.state && event.state.__svelte_spa_router_scrollY) {
    				previousScrollState = event.state;
    			} else {
    				previousScrollState = null;
    			}
    		};

    		// This is removed in the destroy() invocation below
    		window.addEventListener("popstate", popStateChanged);

    		afterUpdate(() => {
    			// If this exists, then this is a back navigation: restore the scroll position
    			if (previousScrollState) {
    				window.scrollTo(previousScrollState.__svelte_spa_router_scrollX, previousScrollState.__svelte_spa_router_scrollY);
    			} else {
    				// Otherwise this is a forward navigation: scroll to top
    				window.scrollTo(0, 0);
    			}
    		});
    	}

    	// Always have the latest value of loc
    	let lastLoc = null;

    	// Current object of the component loaded
    	let componentObj = null;

    	// Handle hash change events
    	// Listen to changes in the $loc store and update the page
    	// Do not use the $: syntax because it gets triggered by too many things
    	const unsubscribeLoc = loc.subscribe(async newLoc => {
    		lastLoc = newLoc;

    		// Find a route matching the location
    		let i = 0;

    		while (i < routesList.length) {
    			const match = routesList[i].match(newLoc.location);

    			if (!match) {
    				i++;
    				continue;
    			}

    			const detail = {
    				route: routesList[i].path,
    				location: newLoc.location,
    				querystring: newLoc.querystring,
    				userData: routesList[i].userData,
    				params: match && typeof match == "object" && Object.keys(match).length
    				? match
    				: null
    			};

    			// Check if the route can be loaded - if all conditions succeed
    			if (!await routesList[i].checkConditions(detail)) {
    				// Don't display anything
    				$$invalidate(0, component = null);

    				componentObj = null;

    				// Trigger an event to notify the user, then exit
    				dispatchNextTick("conditionsFailed", detail);

    				return;
    			}

    			// Trigger an event to alert that we're loading the route
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick("routeLoading", Object.assign({}, detail));

    			// If there's a component to show while we're loading the route, display it
    			const obj = routesList[i].component;

    			// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
    			if (componentObj != obj) {
    				if (obj.loading) {
    					$$invalidate(0, component = obj.loading);
    					componentObj = obj;
    					$$invalidate(1, componentParams = obj.loadingParams);
    					$$invalidate(2, props = {});

    					// Trigger the routeLoaded event for the loading component
    					// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
    					dispatchNextTick("routeLoaded", Object.assign({}, detail, {
    						component,
    						name: component.name,
    						params: componentParams
    					}));
    				} else {
    					$$invalidate(0, component = null);
    					componentObj = null;
    				}

    				// Invoke the Promise
    				const loaded = await obj();

    				// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
    				if (newLoc != lastLoc) {
    					// Don't update the component, just exit
    					return;
    				}

    				// If there is a "default" property, which is used by async routes, then pick that
    				$$invalidate(0, component = loaded && loaded.default || loaded);

    				componentObj = obj;
    			}

    			// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
    			// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
    			if (match && typeof match == "object" && Object.keys(match).length) {
    				$$invalidate(1, componentParams = match);
    			} else {
    				$$invalidate(1, componentParams = null);
    			}

    			// Set static props, if any
    			$$invalidate(2, props = routesList[i].props);

    			// Dispatch the routeLoaded event then exit
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick("routeLoaded", Object.assign({}, detail, {
    				component,
    				name: component.name,
    				params: componentParams
    			})).then(() => {
    				params.set(componentParams);
    			});

    			return;
    		}

    		// If we're still here, there was no match, so show the empty component
    		$$invalidate(0, component = null);

    		componentObj = null;
    		params.set(undefined);
    	});

    	onDestroy(() => {
    		unsubscribeLoc();
    		popStateChanged && window.removeEventListener("popstate", popStateChanged);
    	});

    	const writable_props = ["routes", "prefix", "restoreScrollState"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	function routeEvent_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function routeEvent_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ("routes" in $$props) $$invalidate(3, routes = $$props.routes);
    		if ("prefix" in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ("restoreScrollState" in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    	};

    	$$self.$capture_state = () => ({
    		readable,
    		writable,
    		derived,
    		tick,
    		_wrap: wrap$1,
    		wrap,
    		getLocation,
    		loc,
    		location,
    		querystring,
    		params,
    		push,
    		pop,
    		replace,
    		link,
    		updateLink,
    		linkOpts,
    		scrollstateHistoryHandler,
    		onDestroy,
    		createEventDispatcher,
    		afterUpdate,
    		parse,
    		routes,
    		prefix,
    		restoreScrollState,
    		RouteItem,
    		routesList,
    		component,
    		componentParams,
    		props,
    		dispatch,
    		dispatchNextTick,
    		previousScrollState,
    		popStateChanged,
    		lastLoc,
    		componentObj,
    		unsubscribeLoc
    	});

    	$$self.$inject_state = $$props => {
    		if ("routes" in $$props) $$invalidate(3, routes = $$props.routes);
    		if ("prefix" in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ("restoreScrollState" in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    		if ("component" in $$props) $$invalidate(0, component = $$props.component);
    		if ("componentParams" in $$props) $$invalidate(1, componentParams = $$props.componentParams);
    		if ("props" in $$props) $$invalidate(2, props = $$props.props);
    		if ("previousScrollState" in $$props) previousScrollState = $$props.previousScrollState;
    		if ("popStateChanged" in $$props) popStateChanged = $$props.popStateChanged;
    		if ("lastLoc" in $$props) lastLoc = $$props.lastLoc;
    		if ("componentObj" in $$props) componentObj = $$props.componentObj;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
    			// Update history.scrollRestoration depending on restoreScrollState
    			history.scrollRestoration = restoreScrollState ? "manual" : "auto";
    		}
    	};

    	return [
    		component,
    		componentParams,
    		props,
    		routes,
    		prefix,
    		restoreScrollState,
    		routeEvent_handler,
    		routeEvent_handler_1
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			routes: 3,
    			prefix: 4,
    			restoreScrollState: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get prefix() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set prefix(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get restoreScrollState() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set restoreScrollState(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/admin/pages/Admin.svelte generated by Svelte v3.38.3 */

    const file$3 = "src/admin/pages/Admin.svelte";

    function create_fragment$3(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Hello!";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Update your DriveStore by clicking here:";
    			attr_dev(h1, "class", "svelte-1tky8bj");
    			add_location(h1, file$3, 7, 1, 92);
    			add_location(p, file$3, 8, 1, 109);
    			attr_dev(main, "class", "svelte-1tky8bj");
    			add_location(main, file$3, 6, 0, 84);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p);

    			if (!mounted) {
    				dispose = listen_dev(p, "click", /*deployTrigger*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Admin", slots, []);

    	const deployTrigger = async () => {
    		alert("deploy trigger");
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Admin> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ deployTrigger });
    	return [deployTrigger];
    }

    class Admin extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Admin",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/product/pages/CategoryList.svelte generated by Svelte v3.38.3 */

    const file$2 = "src/product/pages/CategoryList.svelte";

    function create_fragment$2(ctx) {
    	let ul;
    	let li0;
    	let h20;
    	let t1;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let li1;
    	let h21;
    	let t4;
    	let img1;
    	let img1_src_value;
    	let t5;
    	let li2;
    	let h22;
    	let t7;
    	let img2;
    	let img2_src_value;
    	let t8;
    	let li3;
    	let h23;
    	let t10;
    	let img3;
    	let img3_src_value;
    	let t11;
    	let li4;
    	let h24;
    	let t13;
    	let img4;
    	let img4_src_value;
    	let t14;
    	let li5;
    	let h25;
    	let t16;
    	let img5;
    	let img5_src_value;
    	let t17;
    	let li6;
    	let h26;
    	let t19;
    	let img6;
    	let img6_src_value;
    	let t20;
    	let li7;
    	let h27;
    	let t22;
    	let img7;
    	let img7_src_value;
    	let t23;
    	let li8;
    	let h28;
    	let t25;
    	let img8;
    	let img8_src_value;
    	let t26;
    	let li9;
    	let h29;
    	let t28;
    	let img9;
    	let img9_src_value;
    	let t29;
    	let li10;
    	let h210;
    	let t31;
    	let img10;
    	let img10_src_value;
    	let t32;
    	let li11;
    	let h211;
    	let t34;
    	let img11;
    	let img11_src_value;
    	let t35;
    	let li12;
    	let h212;
    	let t37;
    	let img12;
    	let img12_src_value;
    	let t38;
    	let li13;
    	let h213;
    	let t40;
    	let img13;
    	let img13_src_value;
    	let t41;
    	let li14;
    	let h214;
    	let t43;
    	let img14;
    	let img14_src_value;
    	let t44;
    	let li15;
    	let h215;
    	let t46;
    	let img15;
    	let img15_src_value;
    	let t47;
    	let li16;
    	let h216;
    	let t49;
    	let img16;
    	let img16_src_value;
    	let t50;
    	let li17;
    	let h217;
    	let t52;
    	let img17;
    	let img17_src_value;
    	let t53;
    	let li18;
    	let h218;
    	let t55;
    	let img18;
    	let img18_src_value;
    	let t56;
    	let li19;
    	let h219;
    	let t58;
    	let img19;
    	let img19_src_value;
    	let t59;
    	let li20;
    	let h220;
    	let t61;
    	let img20;
    	let img20_src_value;
    	let t62;
    	let li21;
    	let h221;
    	let t64;
    	let img21;
    	let img21_src_value;
    	let t65;
    	let li22;
    	let h222;
    	let t67;
    	let img22;
    	let img22_src_value;
    	let t68;
    	let li23;
    	let h223;
    	let t70;
    	let img23;
    	let img23_src_value;
    	let t71;
    	let li24;
    	let h224;
    	let t73;
    	let img24;
    	let img24_src_value;
    	let t74;
    	let li25;
    	let h225;
    	let t76;
    	let img25;
    	let img25_src_value;
    	let t77;
    	let li26;
    	let h226;
    	let t79;
    	let img26;
    	let img26_src_value;
    	let t80;
    	let li27;
    	let h227;
    	let t82;
    	let img27;
    	let img27_src_value;
    	let t83;
    	let li28;
    	let h228;
    	let t85;
    	let img28;
    	let img28_src_value;
    	let t86;
    	let li29;
    	let h229;
    	let t88;
    	let img29;
    	let img29_src_value;
    	let t89;
    	let li30;
    	let h230;
    	let t91;
    	let img30;
    	let img30_src_value;
    	let t92;
    	let li31;
    	let h231;
    	let t94;
    	let img31;
    	let img31_src_value;
    	let t95;
    	let li32;
    	let h232;
    	let t97;
    	let img32;
    	let img32_src_value;
    	let t98;
    	let li33;
    	let h233;
    	let t100;
    	let img33;
    	let img33_src_value;
    	let t101;
    	let li34;
    	let h234;
    	let t103;
    	let img34;
    	let img34_src_value;
    	let t104;
    	let li35;
    	let h235;
    	let t106;
    	let img35;
    	let img35_src_value;
    	let t107;
    	let li36;
    	let h236;
    	let t109;
    	let img36;
    	let img36_src_value;
    	let t110;
    	let li37;
    	let h237;
    	let t112;
    	let img37;
    	let img37_src_value;
    	let t113;
    	let li38;
    	let h238;
    	let t115;
    	let img38;
    	let img38_src_value;
    	let t116;
    	let li39;
    	let h239;
    	let t118;
    	let img39;
    	let img39_src_value;
    	let t119;
    	let li40;
    	let h240;
    	let t121;
    	let img40;
    	let img40_src_value;
    	let t122;
    	let li41;
    	let h241;
    	let t124;
    	let img41;
    	let img41_src_value;
    	let t125;
    	let li42;
    	let h242;
    	let t127;
    	let img42;
    	let img42_src_value;
    	let t128;
    	let li43;
    	let h243;
    	let t130;
    	let img43;
    	let img43_src_value;
    	let t131;
    	let li44;
    	let h244;
    	let t133;
    	let img44;
    	let img44_src_value;
    	let t134;
    	let li45;
    	let h245;
    	let t136;
    	let img45;
    	let img45_src_value;
    	let t137;
    	let li46;
    	let h246;
    	let t139;
    	let img46;
    	let img46_src_value;
    	let t140;
    	let li47;
    	let h247;
    	let t142;
    	let img47;
    	let img47_src_value;
    	let t143;
    	let li48;
    	let h248;
    	let t145;
    	let img48;
    	let img48_src_value;
    	let t146;
    	let li49;
    	let h249;
    	let t148;
    	let img49;
    	let img49_src_value;
    	let t149;
    	let li50;
    	let h250;
    	let t151;
    	let img50;
    	let img50_src_value;
    	let t152;
    	let li51;
    	let h251;
    	let t154;
    	let img51;
    	let img51_src_value;
    	let t155;
    	let li52;
    	let h252;
    	let t157;
    	let img52;
    	let img52_src_value;
    	let t158;
    	let li53;
    	let h253;
    	let t160;
    	let img53;
    	let img53_src_value;
    	let t161;
    	let li54;
    	let h254;
    	let t163;
    	let img54;
    	let img54_src_value;
    	let t164;
    	let li55;
    	let h255;
    	let t166;
    	let img55;
    	let img55_src_value;
    	let t167;
    	let li56;
    	let h256;
    	let t169;
    	let img56;
    	let img56_src_value;
    	let t170;
    	let li57;
    	let h257;
    	let t172;
    	let img57;
    	let img57_src_value;
    	let t173;
    	let li58;
    	let h258;
    	let t175;
    	let img58;
    	let img58_src_value;
    	let t176;
    	let li59;
    	let h259;
    	let t178;
    	let img59;
    	let img59_src_value;
    	let t179;
    	let li60;
    	let h260;
    	let t181;
    	let img60;
    	let img60_src_value;
    	let t182;
    	let li61;
    	let h261;
    	let t184;
    	let img61;
    	let img61_src_value;
    	let t185;
    	let li62;
    	let h262;
    	let t187;
    	let img62;
    	let img62_src_value;
    	let t188;
    	let li63;
    	let h263;
    	let t190;
    	let img63;
    	let img63_src_value;

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			li0 = element("li");
    			h20 = element("h2");
    			h20.textContent = "1nSc059kqC_MkaPz0HJLIcwyiJK8PXLKA -";
    			t1 = space();
    			img0 = element("img");
    			t2 = space();
    			li1 = element("li");
    			h21 = element("h2");
    			h21.textContent = "1cnTK4STT1j1rZb2wGptGqK3r6fRn-x6G -";
    			t4 = space();
    			img1 = element("img");
    			t5 = space();
    			li2 = element("li");
    			h22 = element("h2");
    			h22.textContent = "1cz9ETkkC2t0FivjKIeXf3rgsA3JUz4Kc -";
    			t7 = space();
    			img2 = element("img");
    			t8 = space();
    			li3 = element("li");
    			h23 = element("h2");
    			h23.textContent = "1KjhlLng_U5qJZG3i-M7rmeHt1ADL-ed8 -";
    			t10 = space();
    			img3 = element("img");
    			t11 = space();
    			li4 = element("li");
    			h24 = element("h2");
    			h24.textContent = "1XqFFBmril6JG6ucHEGDCouzw4zaASwsE -";
    			t13 = space();
    			img4 = element("img");
    			t14 = space();
    			li5 = element("li");
    			h25 = element("h2");
    			h25.textContent = "1eQ-Tv1P8fBMxabPijRoQTw-XscIna26m -";
    			t16 = space();
    			img5 = element("img");
    			t17 = space();
    			li6 = element("li");
    			h26 = element("h2");
    			h26.textContent = "1duV_ytS6aMPgNRAb5vcDR5CB70I1Cj1j -";
    			t19 = space();
    			img6 = element("img");
    			t20 = space();
    			li7 = element("li");
    			h27 = element("h2");
    			h27.textContent = "1lN_mJV2Qq8mgQ8Br1eClxtxzs_dObs-k -";
    			t22 = space();
    			img7 = element("img");
    			t23 = space();
    			li8 = element("li");
    			h28 = element("h2");
    			h28.textContent = "1iyk5gqb-NuKtESgfFclj4PIY3mJCDCEh -";
    			t25 = space();
    			img8 = element("img");
    			t26 = space();
    			li9 = element("li");
    			h29 = element("h2");
    			h29.textContent = "1WgHF_DgTqbWYjuWSvlGLy290CZubVXOU -";
    			t28 = space();
    			img9 = element("img");
    			t29 = space();
    			li10 = element("li");
    			h210 = element("h2");
    			h210.textContent = "1pv0d7nV6fuDjc9TJE7Zou73-G5YSV8eb -";
    			t31 = space();
    			img10 = element("img");
    			t32 = space();
    			li11 = element("li");
    			h211 = element("h2");
    			h211.textContent = "1emZ561O28YX41f7NT73Lkp7rqrp8KEK3 -";
    			t34 = space();
    			img11 = element("img");
    			t35 = space();
    			li12 = element("li");
    			h212 = element("h2");
    			h212.textContent = "12Jwr5xDWPojDiW6bZdIaJEL9odOX1-Mx -";
    			t37 = space();
    			img12 = element("img");
    			t38 = space();
    			li13 = element("li");
    			h213 = element("h2");
    			h213.textContent = "1nZhEfkAvCL8MZ2nW5AXWr3iQLhljKtas -";
    			t40 = space();
    			img13 = element("img");
    			t41 = space();
    			li14 = element("li");
    			h214 = element("h2");
    			h214.textContent = "1cjLw7WgMKhU_1PX4Q1I635QSinOQ8EPe -";
    			t43 = space();
    			img14 = element("img");
    			t44 = space();
    			li15 = element("li");
    			h215 = element("h2");
    			h215.textContent = "1YtJFMLhZYJajKIb7004F5-3Klnsz0cRK -";
    			t46 = space();
    			img15 = element("img");
    			t47 = space();
    			li16 = element("li");
    			h216 = element("h2");
    			h216.textContent = "1I6VgCzBQn8l_9753L7Ry4riiH3Z56cib -";
    			t49 = space();
    			img16 = element("img");
    			t50 = space();
    			li17 = element("li");
    			h217 = element("h2");
    			h217.textContent = "1xb60vKfQwybYPnYk249AomYID8Pyh8Gt -";
    			t52 = space();
    			img17 = element("img");
    			t53 = space();
    			li18 = element("li");
    			h218 = element("h2");
    			h218.textContent = "1YWRrO4gti4pNA5a5B3h7ekYWLdl0n-kJ -";
    			t55 = space();
    			img18 = element("img");
    			t56 = space();
    			li19 = element("li");
    			h219 = element("h2");
    			h219.textContent = "1CoRiboDLE--7BDCqMNCvkNv3zDJB5kCu -";
    			t58 = space();
    			img19 = element("img");
    			t59 = space();
    			li20 = element("li");
    			h220 = element("h2");
    			h220.textContent = "10VqyMOEk7zRUA6qkxZ44-11WK6_ichn3 -";
    			t61 = space();
    			img20 = element("img");
    			t62 = space();
    			li21 = element("li");
    			h221 = element("h2");
    			h221.textContent = "1Un-fbf_qnxY1CAkTBLCblKhgVon17Dg8 -";
    			t64 = space();
    			img21 = element("img");
    			t65 = space();
    			li22 = element("li");
    			h222 = element("h2");
    			h222.textContent = "1wTIJX9qRmMsXV0p8N55VC60ooJh8HB59 -";
    			t67 = space();
    			img22 = element("img");
    			t68 = space();
    			li23 = element("li");
    			h223 = element("h2");
    			h223.textContent = "1veaLy9w0Hn6Qm99vBAp1ihvWlenAqZur -";
    			t70 = space();
    			img23 = element("img");
    			t71 = space();
    			li24 = element("li");
    			h224 = element("h2");
    			h224.textContent = "1Kheydv3Q90tc946vFdK2DHjx-9cKXOuO -";
    			t73 = space();
    			img24 = element("img");
    			t74 = space();
    			li25 = element("li");
    			h225 = element("h2");
    			h225.textContent = "1z4jour1Zz2ftlgFBkxa6Acu2-LREse6r -";
    			t76 = space();
    			img25 = element("img");
    			t77 = space();
    			li26 = element("li");
    			h226 = element("h2");
    			h226.textContent = "1Y8xrOKiKn6jw1ZtMpJnLpXobtBk9F5bU -";
    			t79 = space();
    			img26 = element("img");
    			t80 = space();
    			li27 = element("li");
    			h227 = element("h2");
    			h227.textContent = "1w9bUB11hYD_iruOIoVetzH9MM8wGFbpu -";
    			t82 = space();
    			img27 = element("img");
    			t83 = space();
    			li28 = element("li");
    			h228 = element("h2");
    			h228.textContent = "1IVthECalk5GvVjy7C3rLzCdCt2vXbUEc -";
    			t85 = space();
    			img28 = element("img");
    			t86 = space();
    			li29 = element("li");
    			h229 = element("h2");
    			h229.textContent = "1Gcc8uifnQfvjL1L5bZ1waZIJAhAgx62j -";
    			t88 = space();
    			img29 = element("img");
    			t89 = space();
    			li30 = element("li");
    			h230 = element("h2");
    			h230.textContent = "1r1Ngbtr2L4f314LL1TUN5IHY5qRtsAO9 -";
    			t91 = space();
    			img30 = element("img");
    			t92 = space();
    			li31 = element("li");
    			h231 = element("h2");
    			h231.textContent = "1tBnkvsPf06RQHlXMvQTA0EBThJluvZGX -";
    			t94 = space();
    			img31 = element("img");
    			t95 = space();
    			li32 = element("li");
    			h232 = element("h2");
    			h232.textContent = "1OQq4Ms4aVXOcbncRVogyQGWCQ5MWZt9r -";
    			t97 = space();
    			img32 = element("img");
    			t98 = space();
    			li33 = element("li");
    			h233 = element("h2");
    			h233.textContent = "1QQQ7PJgnpNO9RkJEMShmMQ_oV_Nxowr1 -";
    			t100 = space();
    			img33 = element("img");
    			t101 = space();
    			li34 = element("li");
    			h234 = element("h2");
    			h234.textContent = "1NPEHXNccuYeLgnprTnzL1kO6zlmltfvR -";
    			t103 = space();
    			img34 = element("img");
    			t104 = space();
    			li35 = element("li");
    			h235 = element("h2");
    			h235.textContent = "1L-aLuvgZeI7UaB-y2wplWHWtR-uC0YNb -";
    			t106 = space();
    			img35 = element("img");
    			t107 = space();
    			li36 = element("li");
    			h236 = element("h2");
    			h236.textContent = "1wrxIlURMiqTEO0VwH7B4w2PdZ_8Q2O9m -";
    			t109 = space();
    			img36 = element("img");
    			t110 = space();
    			li37 = element("li");
    			h237 = element("h2");
    			h237.textContent = "1UyO_DLhdKfr_EbCVkQ5Swn2AofvG_3ck -";
    			t112 = space();
    			img37 = element("img");
    			t113 = space();
    			li38 = element("li");
    			h238 = element("h2");
    			h238.textContent = "1pXRGw1SdU7k8vzCFFC1C2j_bv8uVfjiH -";
    			t115 = space();
    			img38 = element("img");
    			t116 = space();
    			li39 = element("li");
    			h239 = element("h2");
    			h239.textContent = "1pDOv1N727nfoRHwPvuyvOiM5Rs6vOMAB -";
    			t118 = space();
    			img39 = element("img");
    			t119 = space();
    			li40 = element("li");
    			h240 = element("h2");
    			h240.textContent = "1_3G8FmJZFy32nnvzPn5dE49UJmCi4Ry4 -";
    			t121 = space();
    			img40 = element("img");
    			t122 = space();
    			li41 = element("li");
    			h241 = element("h2");
    			h241.textContent = "1CvuqmPU-B2EZhqXsrbFRFejQYJ41-7_3 -";
    			t124 = space();
    			img41 = element("img");
    			t125 = space();
    			li42 = element("li");
    			h242 = element("h2");
    			h242.textContent = "1dtkawqB22Cz4KKLh0k0ILDIG4i0ELBPu -";
    			t127 = space();
    			img42 = element("img");
    			t128 = space();
    			li43 = element("li");
    			h243 = element("h2");
    			h243.textContent = "1G2tb5dWMACWS5yIBcoY2bhm2fYhK0Ex2 -";
    			t130 = space();
    			img43 = element("img");
    			t131 = space();
    			li44 = element("li");
    			h244 = element("h2");
    			h244.textContent = "1T8Q7vlY2lD9XR8muYD3GSFuxclU1Lufo -";
    			t133 = space();
    			img44 = element("img");
    			t134 = space();
    			li45 = element("li");
    			h245 = element("h2");
    			h245.textContent = "1VE6DrW2DwGCZsUSal8X4HH2Ya-FGIU38 -";
    			t136 = space();
    			img45 = element("img");
    			t137 = space();
    			li46 = element("li");
    			h246 = element("h2");
    			h246.textContent = "14evQdR7Fri12WEDuGceRZYIjWCQ6cs6f -";
    			t139 = space();
    			img46 = element("img");
    			t140 = space();
    			li47 = element("li");
    			h247 = element("h2");
    			h247.textContent = "11AiNTxh16ymDjH056NI5dJaJQfJ9WZiF -";
    			t142 = space();
    			img47 = element("img");
    			t143 = space();
    			li48 = element("li");
    			h248 = element("h2");
    			h248.textContent = "19fCKY0j_R886EAKQp3kkerRnCSrr8oMI -";
    			t145 = space();
    			img48 = element("img");
    			t146 = space();
    			li49 = element("li");
    			h249 = element("h2");
    			h249.textContent = "1-WLrO6ilxfowTCRYg5vm9WHxaQ7IV0bu -";
    			t148 = space();
    			img49 = element("img");
    			t149 = space();
    			li50 = element("li");
    			h250 = element("h2");
    			h250.textContent = "1KGM2XvtC54aQ9rilwHLrrgBfzEYYRu-S -";
    			t151 = space();
    			img50 = element("img");
    			t152 = space();
    			li51 = element("li");
    			h251 = element("h2");
    			h251.textContent = "1XWagFQjtK71GhluW2DNXcMis1VitWDbS -";
    			t154 = space();
    			img51 = element("img");
    			t155 = space();
    			li52 = element("li");
    			h252 = element("h2");
    			h252.textContent = "1POE_vjf6vpVPvpvd6VNOWxGMmCcDo4rj -";
    			t157 = space();
    			img52 = element("img");
    			t158 = space();
    			li53 = element("li");
    			h253 = element("h2");
    			h253.textContent = "1_1aoitLRBYUd_kNhLIf8cc-fGpbdAbLw -";
    			t160 = space();
    			img53 = element("img");
    			t161 = space();
    			li54 = element("li");
    			h254 = element("h2");
    			h254.textContent = "1OHE3r1PyXAPCytDhH1cDxpWYgQoI09Ey -";
    			t163 = space();
    			img54 = element("img");
    			t164 = space();
    			li55 = element("li");
    			h255 = element("h2");
    			h255.textContent = "1LsgV8X387MJt4W_yYB8wzu-c-3Qx8hel -";
    			t166 = space();
    			img55 = element("img");
    			t167 = space();
    			li56 = element("li");
    			h256 = element("h2");
    			h256.textContent = "1ZCS84tKf810y9T47msnxxyuqSUegBp7i -";
    			t169 = space();
    			img56 = element("img");
    			t170 = space();
    			li57 = element("li");
    			h257 = element("h2");
    			h257.textContent = "1rzVXlZvhXQDjb9bhfs1Gkgv7wMLzuxQs -";
    			t172 = space();
    			img57 = element("img");
    			t173 = space();
    			li58 = element("li");
    			h258 = element("h2");
    			h258.textContent = "1jz7Pu7tCme6GEiYP7myfEvyddb9eAuRd -";
    			t175 = space();
    			img58 = element("img");
    			t176 = space();
    			li59 = element("li");
    			h259 = element("h2");
    			h259.textContent = "1Zx7K7r2fhSGdu1jCH_vUHu019VPlhN8c -";
    			t178 = space();
    			img59 = element("img");
    			t179 = space();
    			li60 = element("li");
    			h260 = element("h2");
    			h260.textContent = "1yF1I9tXVfOBHVuHNicI99b2qlyjH8Dng -";
    			t181 = space();
    			img60 = element("img");
    			t182 = space();
    			li61 = element("li");
    			h261 = element("h2");
    			h261.textContent = "1cgHgMNGQFCFBAOlj-_SlHFRg1zfoiphr -";
    			t184 = space();
    			img61 = element("img");
    			t185 = space();
    			li62 = element("li");
    			h262 = element("h2");
    			h262.textContent = "1t1YnZfabgkuMuqSt4CZIXcYLZ6QjTLkM -";
    			t187 = space();
    			img62 = element("img");
    			t188 = space();
    			li63 = element("li");
    			h263 = element("h2");
    			h263.textContent = "1c7VReeXcx5JdInPvz-dfS9GBHVEbT9KT -";
    			t190 = space();
    			img63 = element("img");
    			add_location(h20, file$2, 2, 8, 24);
    			if (img0.src !== (img0_src_value = "")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$2, 3, 8, 79);
    			add_location(li0, file$2, 1, 4, 10);
    			add_location(h21, file$2, 6, 8, 123);
    			if (img1.src !== (img1_src_value = "")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$2, 7, 8, 178);
    			add_location(li1, file$2, 5, 4, 109);
    			add_location(h22, file$2, 10, 8, 222);
    			if (img2.src !== (img2_src_value = "")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$2, 11, 8, 277);
    			add_location(li2, file$2, 9, 4, 208);
    			add_location(h23, file$2, 14, 8, 321);
    			if (img3.src !== (img3_src_value = "")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$2, 15, 8, 376);
    			add_location(li3, file$2, 13, 4, 307);
    			add_location(h24, file$2, 18, 8, 420);
    			if (img4.src !== (img4_src_value = "")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$2, 19, 8, 475);
    			add_location(li4, file$2, 17, 4, 406);
    			add_location(h25, file$2, 22, 8, 519);
    			if (img5.src !== (img5_src_value = "")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$2, 23, 8, 574);
    			add_location(li5, file$2, 21, 4, 505);
    			add_location(h26, file$2, 26, 8, 618);
    			if (img6.src !== (img6_src_value = "")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$2, 27, 8, 673);
    			add_location(li6, file$2, 25, 4, 604);
    			add_location(h27, file$2, 30, 8, 717);
    			if (img7.src !== (img7_src_value = "")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$2, 31, 8, 772);
    			add_location(li7, file$2, 29, 4, 703);
    			add_location(h28, file$2, 34, 8, 816);
    			if (img8.src !== (img8_src_value = "")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$2, 35, 8, 871);
    			add_location(li8, file$2, 33, 4, 802);
    			add_location(h29, file$2, 38, 8, 915);
    			if (img9.src !== (img9_src_value = "")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$2, 39, 8, 970);
    			add_location(li9, file$2, 37, 4, 901);
    			add_location(h210, file$2, 42, 8, 1014);
    			if (img10.src !== (img10_src_value = "")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$2, 43, 8, 1069);
    			add_location(li10, file$2, 41, 4, 1000);
    			add_location(h211, file$2, 46, 8, 1113);
    			if (img11.src !== (img11_src_value = "")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$2, 47, 8, 1168);
    			add_location(li11, file$2, 45, 4, 1099);
    			add_location(h212, file$2, 50, 8, 1212);
    			if (img12.src !== (img12_src_value = "")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$2, 51, 8, 1267);
    			add_location(li12, file$2, 49, 4, 1198);
    			add_location(h213, file$2, 54, 8, 1311);
    			if (img13.src !== (img13_src_value = "")) attr_dev(img13, "src", img13_src_value);
    			add_location(img13, file$2, 55, 8, 1366);
    			add_location(li13, file$2, 53, 4, 1297);
    			add_location(h214, file$2, 58, 8, 1410);
    			if (img14.src !== (img14_src_value = "")) attr_dev(img14, "src", img14_src_value);
    			add_location(img14, file$2, 59, 8, 1465);
    			add_location(li14, file$2, 57, 4, 1396);
    			add_location(h215, file$2, 62, 8, 1509);
    			if (img15.src !== (img15_src_value = "")) attr_dev(img15, "src", img15_src_value);
    			add_location(img15, file$2, 63, 8, 1564);
    			add_location(li15, file$2, 61, 4, 1495);
    			add_location(h216, file$2, 66, 8, 1608);
    			if (img16.src !== (img16_src_value = "")) attr_dev(img16, "src", img16_src_value);
    			add_location(img16, file$2, 67, 8, 1663);
    			add_location(li16, file$2, 65, 4, 1594);
    			add_location(h217, file$2, 70, 8, 1707);
    			if (img17.src !== (img17_src_value = "https://drive.google.com/uc?id=1xb60vKfQwybYPnYk249AomYID8Pyh8Gt&export=download")) attr_dev(img17, "src", img17_src_value);
    			add_location(img17, file$2, 71, 8, 1762);
    			add_location(li17, file$2, 69, 4, 1693);
    			add_location(h218, file$2, 74, 8, 1900);
    			if (img18.src !== (img18_src_value = "https://drive.google.com/uc?id=1YWRrO4gti4pNA5a5B3h7ekYWLdl0n-kJ&export=download")) attr_dev(img18, "src", img18_src_value);
    			add_location(img18, file$2, 75, 8, 1955);
    			add_location(li18, file$2, 73, 4, 1886);
    			add_location(h219, file$2, 78, 8, 2093);
    			if (img19.src !== (img19_src_value = "https://drive.google.com/uc?id=1CoRiboDLE--7BDCqMNCvkNv3zDJB5kCu&export=download")) attr_dev(img19, "src", img19_src_value);
    			add_location(img19, file$2, 79, 8, 2148);
    			add_location(li19, file$2, 77, 4, 2079);
    			add_location(h220, file$2, 82, 8, 2286);
    			if (img20.src !== (img20_src_value = "https://drive.google.com/uc?id=10VqyMOEk7zRUA6qkxZ44-11WK6_ichn3&export=download")) attr_dev(img20, "src", img20_src_value);
    			add_location(img20, file$2, 83, 8, 2341);
    			add_location(li20, file$2, 81, 4, 2272);
    			add_location(h221, file$2, 86, 8, 2479);
    			if (img21.src !== (img21_src_value = "https://drive.google.com/uc?id=1Un-fbf_qnxY1CAkTBLCblKhgVon17Dg8&export=download")) attr_dev(img21, "src", img21_src_value);
    			add_location(img21, file$2, 87, 8, 2534);
    			add_location(li21, file$2, 85, 4, 2465);
    			add_location(h222, file$2, 90, 8, 2672);
    			if (img22.src !== (img22_src_value = "https://drive.google.com/uc?id=1wTIJX9qRmMsXV0p8N55VC60ooJh8HB59&export=download")) attr_dev(img22, "src", img22_src_value);
    			add_location(img22, file$2, 91, 8, 2727);
    			add_location(li22, file$2, 89, 4, 2658);
    			add_location(h223, file$2, 94, 8, 2865);
    			if (img23.src !== (img23_src_value = "https://drive.google.com/uc?id=1veaLy9w0Hn6Qm99vBAp1ihvWlenAqZur&export=download")) attr_dev(img23, "src", img23_src_value);
    			add_location(img23, file$2, 95, 8, 2920);
    			add_location(li23, file$2, 93, 4, 2851);
    			add_location(h224, file$2, 98, 8, 3058);
    			if (img24.src !== (img24_src_value = "https://drive.google.com/uc?id=1Kheydv3Q90tc946vFdK2DHjx-9cKXOuO&export=download")) attr_dev(img24, "src", img24_src_value);
    			add_location(img24, file$2, 99, 8, 3113);
    			add_location(li24, file$2, 97, 4, 3044);
    			add_location(h225, file$2, 102, 8, 3251);
    			if (img25.src !== (img25_src_value = "https://drive.google.com/uc?id=1z4jour1Zz2ftlgFBkxa6Acu2-LREse6r&export=download")) attr_dev(img25, "src", img25_src_value);
    			add_location(img25, file$2, 103, 8, 3306);
    			add_location(li25, file$2, 101, 4, 3237);
    			add_location(h226, file$2, 106, 8, 3444);
    			if (img26.src !== (img26_src_value = "https://drive.google.com/uc?id=1Y8xrOKiKn6jw1ZtMpJnLpXobtBk9F5bU&export=download")) attr_dev(img26, "src", img26_src_value);
    			add_location(img26, file$2, 107, 8, 3499);
    			add_location(li26, file$2, 105, 4, 3430);
    			add_location(h227, file$2, 110, 8, 3637);
    			if (img27.src !== (img27_src_value = "https://drive.google.com/uc?id=1w9bUB11hYD_iruOIoVetzH9MM8wGFbpu&export=download")) attr_dev(img27, "src", img27_src_value);
    			add_location(img27, file$2, 111, 8, 3692);
    			add_location(li27, file$2, 109, 4, 3623);
    			add_location(h228, file$2, 114, 8, 3830);
    			if (img28.src !== (img28_src_value = "https://drive.google.com/uc?id=1IVthECalk5GvVjy7C3rLzCdCt2vXbUEc&export=download")) attr_dev(img28, "src", img28_src_value);
    			add_location(img28, file$2, 115, 8, 3885);
    			add_location(li28, file$2, 113, 4, 3816);
    			add_location(h229, file$2, 118, 8, 4023);
    			if (img29.src !== (img29_src_value = "https://drive.google.com/uc?id=1Gcc8uifnQfvjL1L5bZ1waZIJAhAgx62j&export=download")) attr_dev(img29, "src", img29_src_value);
    			add_location(img29, file$2, 119, 8, 4078);
    			add_location(li29, file$2, 117, 4, 4009);
    			add_location(h230, file$2, 122, 8, 4216);
    			if (img30.src !== (img30_src_value = "https://drive.google.com/uc?id=1r1Ngbtr2L4f314LL1TUN5IHY5qRtsAO9&export=download")) attr_dev(img30, "src", img30_src_value);
    			add_location(img30, file$2, 123, 8, 4271);
    			add_location(li30, file$2, 121, 4, 4202);
    			add_location(h231, file$2, 126, 8, 4409);
    			if (img31.src !== (img31_src_value = "https://drive.google.com/uc?id=1tBnkvsPf06RQHlXMvQTA0EBThJluvZGX&export=download")) attr_dev(img31, "src", img31_src_value);
    			add_location(img31, file$2, 127, 8, 4464);
    			add_location(li31, file$2, 125, 4, 4395);
    			add_location(h232, file$2, 130, 8, 4602);
    			if (img32.src !== (img32_src_value = "https://drive.google.com/uc?id=1OQq4Ms4aVXOcbncRVogyQGWCQ5MWZt9r&export=download")) attr_dev(img32, "src", img32_src_value);
    			add_location(img32, file$2, 131, 8, 4657);
    			add_location(li32, file$2, 129, 4, 4588);
    			add_location(h233, file$2, 134, 8, 4795);
    			if (img33.src !== (img33_src_value = "https://drive.google.com/uc?id=1QQQ7PJgnpNO9RkJEMShmMQ_oV_Nxowr1&export=download")) attr_dev(img33, "src", img33_src_value);
    			add_location(img33, file$2, 135, 8, 4850);
    			add_location(li33, file$2, 133, 4, 4781);
    			add_location(h234, file$2, 138, 8, 4988);
    			if (img34.src !== (img34_src_value = "https://drive.google.com/uc?id=1NPEHXNccuYeLgnprTnzL1kO6zlmltfvR&export=download")) attr_dev(img34, "src", img34_src_value);
    			add_location(img34, file$2, 139, 8, 5043);
    			add_location(li34, file$2, 137, 4, 4974);
    			add_location(h235, file$2, 142, 8, 5181);
    			if (img35.src !== (img35_src_value = "https://drive.google.com/uc?id=1L-aLuvgZeI7UaB-y2wplWHWtR-uC0YNb&export=download")) attr_dev(img35, "src", img35_src_value);
    			add_location(img35, file$2, 143, 8, 5236);
    			add_location(li35, file$2, 141, 4, 5167);
    			add_location(h236, file$2, 146, 8, 5374);
    			if (img36.src !== (img36_src_value = "https://drive.google.com/uc?id=1wrxIlURMiqTEO0VwH7B4w2PdZ_8Q2O9m&export=download")) attr_dev(img36, "src", img36_src_value);
    			add_location(img36, file$2, 147, 8, 5429);
    			add_location(li36, file$2, 145, 4, 5360);
    			add_location(h237, file$2, 150, 8, 5567);
    			if (img37.src !== (img37_src_value = "https://drive.google.com/uc?id=1UyO_DLhdKfr_EbCVkQ5Swn2AofvG_3ck&export=download")) attr_dev(img37, "src", img37_src_value);
    			add_location(img37, file$2, 151, 8, 5622);
    			add_location(li37, file$2, 149, 4, 5553);
    			add_location(h238, file$2, 154, 8, 5760);
    			if (img38.src !== (img38_src_value = "https://drive.google.com/uc?id=1pXRGw1SdU7k8vzCFFC1C2j_bv8uVfjiH&export=download")) attr_dev(img38, "src", img38_src_value);
    			add_location(img38, file$2, 155, 8, 5815);
    			add_location(li38, file$2, 153, 4, 5746);
    			add_location(h239, file$2, 158, 8, 5953);
    			if (img39.src !== (img39_src_value = "https://drive.google.com/uc?id=1pDOv1N727nfoRHwPvuyvOiM5Rs6vOMAB&export=download")) attr_dev(img39, "src", img39_src_value);
    			add_location(img39, file$2, 159, 8, 6008);
    			add_location(li39, file$2, 157, 4, 5939);
    			add_location(h240, file$2, 162, 8, 6146);
    			if (img40.src !== (img40_src_value = "https://drive.google.com/uc?id=1_3G8FmJZFy32nnvzPn5dE49UJmCi4Ry4&export=download")) attr_dev(img40, "src", img40_src_value);
    			add_location(img40, file$2, 163, 8, 6201);
    			add_location(li40, file$2, 161, 4, 6132);
    			add_location(h241, file$2, 166, 8, 6339);
    			if (img41.src !== (img41_src_value = "https://drive.google.com/uc?id=1CvuqmPU-B2EZhqXsrbFRFejQYJ41-7_3&export=download")) attr_dev(img41, "src", img41_src_value);
    			add_location(img41, file$2, 167, 8, 6394);
    			add_location(li41, file$2, 165, 4, 6325);
    			add_location(h242, file$2, 170, 8, 6532);
    			if (img42.src !== (img42_src_value = "https://drive.google.com/uc?id=1dtkawqB22Cz4KKLh0k0ILDIG4i0ELBPu&export=download")) attr_dev(img42, "src", img42_src_value);
    			add_location(img42, file$2, 171, 8, 6587);
    			add_location(li42, file$2, 169, 4, 6518);
    			add_location(h243, file$2, 174, 8, 6725);
    			if (img43.src !== (img43_src_value = "https://drive.google.com/uc?id=1G2tb5dWMACWS5yIBcoY2bhm2fYhK0Ex2&export=download")) attr_dev(img43, "src", img43_src_value);
    			add_location(img43, file$2, 175, 8, 6780);
    			add_location(li43, file$2, 173, 4, 6711);
    			add_location(h244, file$2, 178, 8, 6918);
    			if (img44.src !== (img44_src_value = "https://drive.google.com/uc?id=1T8Q7vlY2lD9XR8muYD3GSFuxclU1Lufo&export=download")) attr_dev(img44, "src", img44_src_value);
    			add_location(img44, file$2, 179, 8, 6973);
    			add_location(li44, file$2, 177, 4, 6904);
    			add_location(h245, file$2, 182, 8, 7111);
    			if (img45.src !== (img45_src_value = "https://drive.google.com/uc?id=1VE6DrW2DwGCZsUSal8X4HH2Ya-FGIU38&export=download")) attr_dev(img45, "src", img45_src_value);
    			add_location(img45, file$2, 183, 8, 7166);
    			add_location(li45, file$2, 181, 4, 7097);
    			add_location(h246, file$2, 186, 8, 7304);
    			if (img46.src !== (img46_src_value = "https://drive.google.com/uc?id=14evQdR7Fri12WEDuGceRZYIjWCQ6cs6f&export=download")) attr_dev(img46, "src", img46_src_value);
    			add_location(img46, file$2, 187, 8, 7359);
    			add_location(li46, file$2, 185, 4, 7290);
    			add_location(h247, file$2, 190, 8, 7497);
    			if (img47.src !== (img47_src_value = "https://drive.google.com/uc?id=11AiNTxh16ymDjH056NI5dJaJQfJ9WZiF&export=download")) attr_dev(img47, "src", img47_src_value);
    			add_location(img47, file$2, 191, 8, 7552);
    			add_location(li47, file$2, 189, 4, 7483);
    			add_location(h248, file$2, 194, 8, 7690);
    			if (img48.src !== (img48_src_value = "https://drive.google.com/uc?id=19fCKY0j_R886EAKQp3kkerRnCSrr8oMI&export=download")) attr_dev(img48, "src", img48_src_value);
    			add_location(img48, file$2, 195, 8, 7745);
    			add_location(li48, file$2, 193, 4, 7676);
    			add_location(h249, file$2, 198, 8, 7883);
    			if (img49.src !== (img49_src_value = "https://drive.google.com/uc?id=1-WLrO6ilxfowTCRYg5vm9WHxaQ7IV0bu&export=download")) attr_dev(img49, "src", img49_src_value);
    			add_location(img49, file$2, 199, 8, 7938);
    			add_location(li49, file$2, 197, 4, 7869);
    			add_location(h250, file$2, 202, 8, 8076);
    			if (img50.src !== (img50_src_value = "https://drive.google.com/uc?id=1KGM2XvtC54aQ9rilwHLrrgBfzEYYRu-S&export=download")) attr_dev(img50, "src", img50_src_value);
    			add_location(img50, file$2, 203, 8, 8131);
    			add_location(li50, file$2, 201, 4, 8062);
    			add_location(h251, file$2, 206, 8, 8269);
    			if (img51.src !== (img51_src_value = "https://drive.google.com/uc?id=1XWagFQjtK71GhluW2DNXcMis1VitWDbS&export=download")) attr_dev(img51, "src", img51_src_value);
    			add_location(img51, file$2, 207, 8, 8324);
    			add_location(li51, file$2, 205, 4, 8255);
    			add_location(h252, file$2, 210, 8, 8462);
    			if (img52.src !== (img52_src_value = "https://drive.google.com/uc?id=1POE_vjf6vpVPvpvd6VNOWxGMmCcDo4rj&export=download")) attr_dev(img52, "src", img52_src_value);
    			add_location(img52, file$2, 211, 8, 8517);
    			add_location(li52, file$2, 209, 4, 8448);
    			add_location(h253, file$2, 214, 8, 8655);
    			if (img53.src !== (img53_src_value = "https://drive.google.com/uc?id=1_1aoitLRBYUd_kNhLIf8cc-fGpbdAbLw&export=download")) attr_dev(img53, "src", img53_src_value);
    			add_location(img53, file$2, 215, 8, 8710);
    			add_location(li53, file$2, 213, 4, 8641);
    			add_location(h254, file$2, 218, 8, 8848);
    			if (img54.src !== (img54_src_value = "https://drive.google.com/uc?id=1OHE3r1PyXAPCytDhH1cDxpWYgQoI09Ey&export=download")) attr_dev(img54, "src", img54_src_value);
    			add_location(img54, file$2, 219, 8, 8903);
    			add_location(li54, file$2, 217, 4, 8834);
    			add_location(h255, file$2, 222, 8, 9041);
    			if (img55.src !== (img55_src_value = "https://drive.google.com/uc?id=1LsgV8X387MJt4W_yYB8wzu-c-3Qx8hel&export=download")) attr_dev(img55, "src", img55_src_value);
    			add_location(img55, file$2, 223, 8, 9096);
    			add_location(li55, file$2, 221, 4, 9027);
    			add_location(h256, file$2, 226, 8, 9234);
    			if (img56.src !== (img56_src_value = "https://drive.google.com/uc?id=1ZCS84tKf810y9T47msnxxyuqSUegBp7i&export=download")) attr_dev(img56, "src", img56_src_value);
    			add_location(img56, file$2, 227, 8, 9289);
    			add_location(li56, file$2, 225, 4, 9220);
    			add_location(h257, file$2, 230, 8, 9427);
    			if (img57.src !== (img57_src_value = "https://drive.google.com/uc?id=1rzVXlZvhXQDjb9bhfs1Gkgv7wMLzuxQs&export=download")) attr_dev(img57, "src", img57_src_value);
    			add_location(img57, file$2, 231, 8, 9482);
    			add_location(li57, file$2, 229, 4, 9413);
    			add_location(h258, file$2, 234, 8, 9620);
    			if (img58.src !== (img58_src_value = "https://drive.google.com/uc?id=1jz7Pu7tCme6GEiYP7myfEvyddb9eAuRd&export=download")) attr_dev(img58, "src", img58_src_value);
    			add_location(img58, file$2, 235, 8, 9675);
    			add_location(li58, file$2, 233, 4, 9606);
    			add_location(h259, file$2, 238, 8, 9813);
    			if (img59.src !== (img59_src_value = "https://drive.google.com/uc?id=1Zx7K7r2fhSGdu1jCH_vUHu019VPlhN8c&export=download")) attr_dev(img59, "src", img59_src_value);
    			add_location(img59, file$2, 239, 8, 9868);
    			add_location(li59, file$2, 237, 4, 9799);
    			add_location(h260, file$2, 242, 8, 10006);
    			if (img60.src !== (img60_src_value = "https://drive.google.com/uc?id=1yF1I9tXVfOBHVuHNicI99b2qlyjH8Dng&export=download")) attr_dev(img60, "src", img60_src_value);
    			add_location(img60, file$2, 243, 8, 10061);
    			add_location(li60, file$2, 241, 4, 9992);
    			add_location(h261, file$2, 246, 8, 10199);
    			if (img61.src !== (img61_src_value = "https://drive.google.com/uc?id=1cgHgMNGQFCFBAOlj-_SlHFRg1zfoiphr&export=download")) attr_dev(img61, "src", img61_src_value);
    			add_location(img61, file$2, 247, 8, 10254);
    			add_location(li61, file$2, 245, 4, 10185);
    			add_location(h262, file$2, 250, 8, 10392);
    			if (img62.src !== (img62_src_value = "https://drive.google.com/uc?id=1t1YnZfabgkuMuqSt4CZIXcYLZ6QjTLkM&export=download")) attr_dev(img62, "src", img62_src_value);
    			add_location(img62, file$2, 251, 8, 10447);
    			add_location(li62, file$2, 249, 4, 10378);
    			add_location(h263, file$2, 254, 8, 10585);
    			if (img63.src !== (img63_src_value = "https://drive.google.com/uc?id=1c7VReeXcx5JdInPvz-dfS9GBHVEbT9KT&export=download")) attr_dev(img63, "src", img63_src_value);
    			add_location(img63, file$2, 255, 8, 10640);
    			add_location(li63, file$2, 253, 4, 10571);
    			add_location(ul, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);
    			append_dev(ul, li0);
    			append_dev(li0, h20);
    			append_dev(li0, t1);
    			append_dev(li0, img0);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, h21);
    			append_dev(li1, t4);
    			append_dev(li1, img1);
    			append_dev(ul, t5);
    			append_dev(ul, li2);
    			append_dev(li2, h22);
    			append_dev(li2, t7);
    			append_dev(li2, img2);
    			append_dev(ul, t8);
    			append_dev(ul, li3);
    			append_dev(li3, h23);
    			append_dev(li3, t10);
    			append_dev(li3, img3);
    			append_dev(ul, t11);
    			append_dev(ul, li4);
    			append_dev(li4, h24);
    			append_dev(li4, t13);
    			append_dev(li4, img4);
    			append_dev(ul, t14);
    			append_dev(ul, li5);
    			append_dev(li5, h25);
    			append_dev(li5, t16);
    			append_dev(li5, img5);
    			append_dev(ul, t17);
    			append_dev(ul, li6);
    			append_dev(li6, h26);
    			append_dev(li6, t19);
    			append_dev(li6, img6);
    			append_dev(ul, t20);
    			append_dev(ul, li7);
    			append_dev(li7, h27);
    			append_dev(li7, t22);
    			append_dev(li7, img7);
    			append_dev(ul, t23);
    			append_dev(ul, li8);
    			append_dev(li8, h28);
    			append_dev(li8, t25);
    			append_dev(li8, img8);
    			append_dev(ul, t26);
    			append_dev(ul, li9);
    			append_dev(li9, h29);
    			append_dev(li9, t28);
    			append_dev(li9, img9);
    			append_dev(ul, t29);
    			append_dev(ul, li10);
    			append_dev(li10, h210);
    			append_dev(li10, t31);
    			append_dev(li10, img10);
    			append_dev(ul, t32);
    			append_dev(ul, li11);
    			append_dev(li11, h211);
    			append_dev(li11, t34);
    			append_dev(li11, img11);
    			append_dev(ul, t35);
    			append_dev(ul, li12);
    			append_dev(li12, h212);
    			append_dev(li12, t37);
    			append_dev(li12, img12);
    			append_dev(ul, t38);
    			append_dev(ul, li13);
    			append_dev(li13, h213);
    			append_dev(li13, t40);
    			append_dev(li13, img13);
    			append_dev(ul, t41);
    			append_dev(ul, li14);
    			append_dev(li14, h214);
    			append_dev(li14, t43);
    			append_dev(li14, img14);
    			append_dev(ul, t44);
    			append_dev(ul, li15);
    			append_dev(li15, h215);
    			append_dev(li15, t46);
    			append_dev(li15, img15);
    			append_dev(ul, t47);
    			append_dev(ul, li16);
    			append_dev(li16, h216);
    			append_dev(li16, t49);
    			append_dev(li16, img16);
    			append_dev(ul, t50);
    			append_dev(ul, li17);
    			append_dev(li17, h217);
    			append_dev(li17, t52);
    			append_dev(li17, img17);
    			append_dev(ul, t53);
    			append_dev(ul, li18);
    			append_dev(li18, h218);
    			append_dev(li18, t55);
    			append_dev(li18, img18);
    			append_dev(ul, t56);
    			append_dev(ul, li19);
    			append_dev(li19, h219);
    			append_dev(li19, t58);
    			append_dev(li19, img19);
    			append_dev(ul, t59);
    			append_dev(ul, li20);
    			append_dev(li20, h220);
    			append_dev(li20, t61);
    			append_dev(li20, img20);
    			append_dev(ul, t62);
    			append_dev(ul, li21);
    			append_dev(li21, h221);
    			append_dev(li21, t64);
    			append_dev(li21, img21);
    			append_dev(ul, t65);
    			append_dev(ul, li22);
    			append_dev(li22, h222);
    			append_dev(li22, t67);
    			append_dev(li22, img22);
    			append_dev(ul, t68);
    			append_dev(ul, li23);
    			append_dev(li23, h223);
    			append_dev(li23, t70);
    			append_dev(li23, img23);
    			append_dev(ul, t71);
    			append_dev(ul, li24);
    			append_dev(li24, h224);
    			append_dev(li24, t73);
    			append_dev(li24, img24);
    			append_dev(ul, t74);
    			append_dev(ul, li25);
    			append_dev(li25, h225);
    			append_dev(li25, t76);
    			append_dev(li25, img25);
    			append_dev(ul, t77);
    			append_dev(ul, li26);
    			append_dev(li26, h226);
    			append_dev(li26, t79);
    			append_dev(li26, img26);
    			append_dev(ul, t80);
    			append_dev(ul, li27);
    			append_dev(li27, h227);
    			append_dev(li27, t82);
    			append_dev(li27, img27);
    			append_dev(ul, t83);
    			append_dev(ul, li28);
    			append_dev(li28, h228);
    			append_dev(li28, t85);
    			append_dev(li28, img28);
    			append_dev(ul, t86);
    			append_dev(ul, li29);
    			append_dev(li29, h229);
    			append_dev(li29, t88);
    			append_dev(li29, img29);
    			append_dev(ul, t89);
    			append_dev(ul, li30);
    			append_dev(li30, h230);
    			append_dev(li30, t91);
    			append_dev(li30, img30);
    			append_dev(ul, t92);
    			append_dev(ul, li31);
    			append_dev(li31, h231);
    			append_dev(li31, t94);
    			append_dev(li31, img31);
    			append_dev(ul, t95);
    			append_dev(ul, li32);
    			append_dev(li32, h232);
    			append_dev(li32, t97);
    			append_dev(li32, img32);
    			append_dev(ul, t98);
    			append_dev(ul, li33);
    			append_dev(li33, h233);
    			append_dev(li33, t100);
    			append_dev(li33, img33);
    			append_dev(ul, t101);
    			append_dev(ul, li34);
    			append_dev(li34, h234);
    			append_dev(li34, t103);
    			append_dev(li34, img34);
    			append_dev(ul, t104);
    			append_dev(ul, li35);
    			append_dev(li35, h235);
    			append_dev(li35, t106);
    			append_dev(li35, img35);
    			append_dev(ul, t107);
    			append_dev(ul, li36);
    			append_dev(li36, h236);
    			append_dev(li36, t109);
    			append_dev(li36, img36);
    			append_dev(ul, t110);
    			append_dev(ul, li37);
    			append_dev(li37, h237);
    			append_dev(li37, t112);
    			append_dev(li37, img37);
    			append_dev(ul, t113);
    			append_dev(ul, li38);
    			append_dev(li38, h238);
    			append_dev(li38, t115);
    			append_dev(li38, img38);
    			append_dev(ul, t116);
    			append_dev(ul, li39);
    			append_dev(li39, h239);
    			append_dev(li39, t118);
    			append_dev(li39, img39);
    			append_dev(ul, t119);
    			append_dev(ul, li40);
    			append_dev(li40, h240);
    			append_dev(li40, t121);
    			append_dev(li40, img40);
    			append_dev(ul, t122);
    			append_dev(ul, li41);
    			append_dev(li41, h241);
    			append_dev(li41, t124);
    			append_dev(li41, img41);
    			append_dev(ul, t125);
    			append_dev(ul, li42);
    			append_dev(li42, h242);
    			append_dev(li42, t127);
    			append_dev(li42, img42);
    			append_dev(ul, t128);
    			append_dev(ul, li43);
    			append_dev(li43, h243);
    			append_dev(li43, t130);
    			append_dev(li43, img43);
    			append_dev(ul, t131);
    			append_dev(ul, li44);
    			append_dev(li44, h244);
    			append_dev(li44, t133);
    			append_dev(li44, img44);
    			append_dev(ul, t134);
    			append_dev(ul, li45);
    			append_dev(li45, h245);
    			append_dev(li45, t136);
    			append_dev(li45, img45);
    			append_dev(ul, t137);
    			append_dev(ul, li46);
    			append_dev(li46, h246);
    			append_dev(li46, t139);
    			append_dev(li46, img46);
    			append_dev(ul, t140);
    			append_dev(ul, li47);
    			append_dev(li47, h247);
    			append_dev(li47, t142);
    			append_dev(li47, img47);
    			append_dev(ul, t143);
    			append_dev(ul, li48);
    			append_dev(li48, h248);
    			append_dev(li48, t145);
    			append_dev(li48, img48);
    			append_dev(ul, t146);
    			append_dev(ul, li49);
    			append_dev(li49, h249);
    			append_dev(li49, t148);
    			append_dev(li49, img49);
    			append_dev(ul, t149);
    			append_dev(ul, li50);
    			append_dev(li50, h250);
    			append_dev(li50, t151);
    			append_dev(li50, img50);
    			append_dev(ul, t152);
    			append_dev(ul, li51);
    			append_dev(li51, h251);
    			append_dev(li51, t154);
    			append_dev(li51, img51);
    			append_dev(ul, t155);
    			append_dev(ul, li52);
    			append_dev(li52, h252);
    			append_dev(li52, t157);
    			append_dev(li52, img52);
    			append_dev(ul, t158);
    			append_dev(ul, li53);
    			append_dev(li53, h253);
    			append_dev(li53, t160);
    			append_dev(li53, img53);
    			append_dev(ul, t161);
    			append_dev(ul, li54);
    			append_dev(li54, h254);
    			append_dev(li54, t163);
    			append_dev(li54, img54);
    			append_dev(ul, t164);
    			append_dev(ul, li55);
    			append_dev(li55, h255);
    			append_dev(li55, t166);
    			append_dev(li55, img55);
    			append_dev(ul, t167);
    			append_dev(ul, li56);
    			append_dev(li56, h256);
    			append_dev(li56, t169);
    			append_dev(li56, img56);
    			append_dev(ul, t170);
    			append_dev(ul, li57);
    			append_dev(li57, h257);
    			append_dev(li57, t172);
    			append_dev(li57, img57);
    			append_dev(ul, t173);
    			append_dev(ul, li58);
    			append_dev(li58, h258);
    			append_dev(li58, t175);
    			append_dev(li58, img58);
    			append_dev(ul, t176);
    			append_dev(ul, li59);
    			append_dev(li59, h259);
    			append_dev(li59, t178);
    			append_dev(li59, img59);
    			append_dev(ul, t179);
    			append_dev(ul, li60);
    			append_dev(li60, h260);
    			append_dev(li60, t181);
    			append_dev(li60, img60);
    			append_dev(ul, t182);
    			append_dev(ul, li61);
    			append_dev(li61, h261);
    			append_dev(li61, t184);
    			append_dev(li61, img61);
    			append_dev(ul, t185);
    			append_dev(ul, li62);
    			append_dev(li62, h262);
    			append_dev(li62, t187);
    			append_dev(li62, img62);
    			append_dev(ul, t188);
    			append_dev(ul, li63);
    			append_dev(li63, h263);
    			append_dev(li63, t190);
    			append_dev(li63, img63);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("CategoryList", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CategoryList> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class CategoryList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CategoryList",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/product/pages/ProductDetail.svelte generated by Svelte v3.38.3 */

    const file$1 = "src/product/pages/ProductDetail.svelte";

    function create_fragment$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "This is a product detail";
    			add_location(h1, file$1, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ProductDetail", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ProductDetail> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class ProductDetail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ProductDetail",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.38.3 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let router;
    	let current;

    	router = new Router({
    			props: { routes: /*routes*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(router.$$.fragment);
    			attr_dev(main, "class", "svelte-1tky8bj");
    			add_location(main, file, 14, 0, 364);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(router, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(router);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	const routes = {
    		"/": CategoryList,
    		"/:id": CategoryList,
    		"/:id/product/:id": ProductDetail,
    		"/admin": Admin
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Router,
    		Admin,
    		CategoryList,
    		ProductDetail,
    		routes
    	});

    	return [routes];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
