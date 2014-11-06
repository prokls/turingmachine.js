market_spec = {
    title : string,
    description : [string+],
    tape? : tape_spec || {'data':[], 'cursor': 0},
    program? : program_spec,
    state? : string,
    final_states? : [string+],
    max_iterations? : int || 1000,
    testcases? : [object+].each {
        name : string,
        final_states? : [string+] || ["End", "Final"],
        input : {
            state : string,
            tape : tape_spec
        },
        output : {
            final_state? : string,
            unknown_instruction? : boolean,
            halt? : boolean,
            value_written? : value,
            movement_done? : movement,
            exact_number_of_iterations? : int,
            tape : tape_spec
        }
    }
}

tape_spec = {
    blank? : value || "0",
    offset? : int || 0,
    cursor? : int || -1,
    data : [value*]
}

program_spec = [
    [read_symbol!string, from_state!string, write_symbol!value, movement!string, to_state!string]
]