var BloomFilter = require('bloomfilter').BloomFilter;

var bloom = new BloomFilter(
  32 * 256, // number of bits to allocate.
  16        // number of hash functions.
);

// Add some elements to the filter.
bloom.add("foo");
bloom.add("bar");

// Test if an item is in our filter.
// Returns true if an item is probably in the set,
// or false if an item is definitely not in the set.
bloom.test("foo");
bloom.test("bar");
bloom.test("blah");

// Serialisation. Note that bloom.buckets may be a typed array,
// so we convert to a normal array first.
var array = [].slice.call(bloom.buckets),
    json = JSON.stringify(array);

// Deserialisation. Note that the any array-like object is supported, but
// this will be used directly, so you may wish to use a typed array for
// performance.
var bloom = new BloomFilter(array, 3);
