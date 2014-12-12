/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Schmoopiie
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

var Client = require('./client');
var Q      = require('q');

var deferredGet     = Q.defer();
var deferredInsert  = Q.defer();
var deferredList    = Q.defer();
var deferredUpdate  = Q.defer();
var deferredWhere   = Q.defer();
var deferredReplace = Q.defer();
var deferredRemove  = Q.defer();

module.exports = {
    db: {
        /**
         * Insert/add/push a list of elements.
         *
         * @params {string} collection
         * @params {object} elements
         */
        insert: function insert(collection, elements) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            collection.insert(elements);
            collection.save();
            deferredInsert.resolve(null);
            return deferredInsert.promise;
        },
        /**
         * Retrieve elements.
         *
         * @params {string} collection
         * @params {query} query
         */
        where: function where(collection, query) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            deferredWhere.resolve(collection.where(query));
            return deferredWhere.promise;
        },
        /**
         * Retrieve by cid.
         *
         * @params {string} collection
         * @params {integer} cid
         */
        get: function get(collection, cid) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            if (collection.get(cid) === undefined) {
                deferredGet.reject('Cannot retrieve the cid.');
            } else {
                deferredGet.resolve(collection.get(cid));
            }
            return deferredGet.promise;
        },
        /**
         * List all elements in the collection.
         *
         * @params {string} collection
         */
        list: function list(collection) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            deferredList.resolve(collection.items);
            return deferredList.promise;
        },
        /**
         * Update an element, it will add un-existed key and replace existed.
         *
         * @params {string} collection
         * @params {integer} cid
         * @params {object} object
         */
        update: function update(collection, cid, object) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            if (collection.update(cid, object)) {
                collection.save();
                deferredUpdate.resolve(collection.get(cid));
            } else {
                deferredUpdate.reject('Cannot retrieve the cid.');
            }
            return deferredUpdate.promise;
        },
        /**
         * Replace the element with the same cid.
         *
         * @params {string} collection
         * @params {integer} cid
         * @params {object} object
         */
        replace: function replace(collection, cid, object) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            if (collection.replace(cid, object)) {
                collection.save();
                deferredReplace.resolve(collection.get(cid));
            } else {
                deferredReplace.reject('Cannot retrieve the cid.');
            }
            return deferredReplace.promise;
        },
        /**
         * Delete an item by cid.
         *
         * @params {string} collection
         * @params {integer} cid
         */
        remove: function remove(collection, cid) {
            var Database = Client.getDatabase();
            var collection = Database.collection(collection);
            if (collection.remove(cid)) {
                collection.save();
                deferredRemove.resolve(null);
            } else {
                deferredRemove.reject('Cannot retrieve the cid.');
            }
            return deferredRemove.promise;
            return true;
        }
    }
};