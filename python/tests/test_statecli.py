"""
Tests for StateCLI Python client.
"""

import os
import tempfile
import pytest
from statecli import StateCLI


@pytest.fixture
def cli():
    """Create a temporary StateCLI instance for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    client = StateCLI(db_path=db_path)
    yield client
    
    client.close()
    os.unlink(db_path)


def test_track_state_change(cli):
    """Test tracking a state change."""
    result = cli.track("order", "7421", {"status": "pending"})
    
    assert result.entity == "order:7421"
    assert result.id is not None
    assert "Tracked" in result.summary


def test_replay_changes(cli):
    """Test replaying state changes."""
    cli.track("order", "7421", {"status": "pending"})
    cli.track("order", "7421", {"status": "processing"})
    cli.track("order", "7421", {"status": "paid"})
    
    replay = cli.replay("order:7421")
    
    assert replay.entity == "order:7421"
    assert len(replay.changes) == 3
    assert replay.changes[0].step == 1
    assert replay.changes[0].after["status"] == "pending"
    assert replay.changes[2].after["status"] == "paid"


def test_undo_changes(cli):
    """Test undoing state changes."""
    cli.track("order", "7421", {"status": "pending"})
    cli.track("order", "7421", {"status": "processing"})
    
    result = cli.undo("order:7421", steps=1)
    
    assert result.steps_undone == 1
    assert result.restored_state["status"] == "pending"
    
    # Verify only one change remains
    replay = cli.replay("order:7421")
    assert len(replay.changes) == 1


def test_checkpoint_and_restore(cli):
    """Test checkpoint creation and restoration."""
    cli.track("order", "7421", {"status": "pending"})
    
    checkpoint = cli.checkpoint("order:7421", "before-refund")
    assert checkpoint.name == "before-refund"
    assert checkpoint.entity == "order:7421"
    
    # Make more changes
    cli.track("order", "7421", {"status": "refunded"})
    cli.track("order", "7421", {"status": "closed"})
    
    # Restore to checkpoint
    result = cli.restore_checkpoint("order:7421", "before-refund")
    assert result.steps_undone == 2
    
    # Verify state is restored
    replay = cli.replay("order:7421")
    assert len(replay.changes) == 1
    assert replay.changes[0].after["status"] == "pending"


def test_log_with_filter(cli):
    """Test log with actor filter."""
    cli.track("order", "7421", {"status": "pending"}, actor="agent-a")
    cli.track("order", "7421", {"status": "processing"}, actor="agent-b")
    
    log = cli.log("order:7421", actor="agent-a")
    
    assert len(log.changes) == 1
    assert log.changes[0].actor == "agent-a"


def test_log_with_wildcard(cli):
    """Test log with wildcard pattern."""
    cli.track("order", "001", {"status": "pending"})
    cli.track("order", "002", {"status": "pending"})
    cli.track("user", "001", {"name": "Alice"})
    
    log = cli.log("order:*")
    
    assert len(log.changes) == 2


def test_get_current_state(cli):
    """Test getting current state."""
    cli.track("order", "7421", {"status": "pending"})
    cli.track("order", "7421", {"status": "paid", "amount": 49.99})
    
    state = cli.get_current_state("order:7421")
    
    assert state["status"] == "paid"
    assert state["amount"] == 49.99


def test_context_manager(cli):
    """Test using StateCLI as context manager."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    try:
        with StateCLI(db_path=db_path) as client:
            client.track("test", "1", {"value": 42})
            replay = client.replay("test:1")
            assert len(replay.changes) == 1
    finally:
        os.unlink(db_path)
