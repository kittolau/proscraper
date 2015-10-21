
function compute() {
    // performs complicated calculations continuously
	//defer the function execution such that it can event queue can handle other queue
    process.nextTick(compute);
}

function compute() {
    // performs complicated calculations continuously
	// will block event queue until return from recursive call
    compute();
}